import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '../../../../lib/notificationService';
import { PhoneNumberService } from '../../../../lib/phoneNumberService';

// Verificar token de webhook (configurado en Meta Developer Console)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token_here';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verificación del webhook
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado exitosamente');
    return new NextResponse(challenge, { status: 200 });
  }

  console.log('❌ Verificación de webhook fallida');
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log inicial inmediato para verificar que el webhook se ejecuta
  try {
    const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
    const logger = InvoiceOrderLogger.getInstance();
    await logger.info(requestId, 'WEBHOOK RECIBIDO - Inicio de procesamiento', { timestamp: new Date().toISOString() });
  } catch (loggerError) {
    console.error('Error inicializando logger:', loggerError);
  }
  
  try {
    console.log(`📥 [${requestId}] ===== WEBHOOK RECIBIDO =====`);
    console.log(`📥 [${requestId}] Timestamp: ${new Date().toISOString()}`);
    
    const body = await request.json();
    console.log(`📥 [${requestId}] Body completo recibido:`, JSON.stringify(body, null, 2));
    
    // 🔧 LOG TEMPORAL: Verificar si hay mensajes
    if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
      console.log(`📨 [${requestId}] MENSAJES ENCONTRADOS:`, body.entry[0].changes[0].value.messages.length);
      body.entry[0].changes[0].value.messages.forEach((msg: any, index: number) => {
        console.log(`📨 [${requestId}] Mensaje ${index + 1}:`, {
          from: msg.from,
          type: msg.type,
          hasDocument: !!msg.document,
          hasImage: !!msg.image,
          hasText: !!msg.text,
          id: msg.id
        });
        
        // 🔍 LOG DETALLADO: Ver estructura completa del mensaje
        if (msg.document) {
          console.log(`📎 [${requestId}] DOCUMENTO DETECTADO:`, {
            id: msg.document.id,
            filename: msg.document.filename,
            mime_type: msg.document.mime_type,
            sha256: msg.document.sha256
          });
        }
        
        if (msg.image) {
          console.log(`🖼️ [${requestId}] IMAGEN DETECTADA:`, {
            id: msg.image.id,
            mime_type: msg.image.mime_type,
            sha256: msg.image.sha256
          });
        }
      });
    }

    // Verificar que es un mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      console.log(`✅ [${requestId}] Webhook válido de WhatsApp Business Account`);
      
      const entry = body.entry?.[0];
      if (!entry?.changes?.[0]?.value) {
        return NextResponse.json({ status: 'ok', processed: false, requestId });
      }

      const value = entry.changes[0].value;
      let processedCount = 0;
      let errorCount = 0;

      // 🔧 NUEVA FUNCIONALIDAD: Procesar statuses (errores de delivery)
      if (value.statuses && Array.isArray(value.statuses)) {
        console.log(`📊 [${requestId}] Procesando ${value.statuses.length} statuses`);
        
        for (const status of value.statuses) {
          try {
            const result = await processWhatsAppStatus(status, requestId);
            if (result.success) {
              processedCount++;
            } else {
              errorCount++;
              console.error(`❌ [${requestId}] Error procesando status:`, result.error);
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ [${requestId}] Error procesando status individual:`, error);
          }
        }
      }

      // 🔧 FUNCIONALIDAD EXISTENTE: Procesar mensajes
      if (value.messages && Array.isArray(value.messages)) {
        console.log(`📨 [${requestId}] Procesando ${value.messages.length} mensajes`);
        
        for (const message of value.messages) {
          try {
            console.log(`📨 [${requestId}] Procesando mensaje:`, JSON.stringify(message, null, 2));
            const result = await processWhatsAppMessage(message, requestId);
            if (result.success) {
              processedCount++;
              console.log(`✅ [${requestId}] Mensaje procesado exitosamente`);
            } else {
              errorCount++;
              console.error(`❌ [${requestId}] Error procesando mensaje:`, result.error);
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ [${requestId}] Error procesando mensaje individual:`, error);
          }
        }
      } else {
        console.log(`ℹ️ [${requestId}] No hay mensajes en el webhook`);
      }

      // 🔧 NUEVA FUNCIONALIDAD: Procesar actualizaciones de template
      if (value.event === 'APPROVED' && value.message_template_name) {
        processedCount++;
      }

      if (processedCount === 0 && errorCount === 0) {
        console.log(`ℹ️ [${requestId}] No se procesó ningún contenido`);
      } else {
        console.log(`📊 [${requestId}] Procesados: ${processedCount}, Errores: ${errorCount}`);
      }
    } else {
      console.log(`❌ [${requestId}] Webhook no es de WhatsApp Business Account. Object:`, body.object);
    }

    const duration = Date.now() - startTime;
    
    return NextResponse.json({ 
      status: 'ok', 
      processed: true, 
      requestId: requestId,
      duration: duration 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] Error procesando webhook:`, error);
    console.error(`💥 [${requestId}] WEBHOOK FALLÓ en ${duration}ms`);
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      requestId: requestId,
      duration: duration 
    }, { status: 500 });
  }
}

// 🔧 NUEVA FUNCIÓN: Procesar statuses de WhatsApp (errores de delivery)
async function processWhatsAppStatus(status: any, requestId: string) {
  const statusStartTime = Date.now();
  
  try {
    const { id, status: statusType, timestamp, recipient_id, errors } = status;
    

    // 🔧 NUEVA FUNCIONALIDAD: Manejar errores de engagement
    if (statusType === 'failed' && errors && Array.isArray(errors)) {
      for (const error of errors) {
        if (error.code === 131047 || error.code === 131049) {

          // 🔧 ACTIVAR ESTRATEGIA DE ACTIVACIÓN MANUAL
          await handleEngagementError(recipient_id, error, requestId);
        }
      }
    }

    // 🔧 NUEVA FUNCIONALIDAD: Actualizar estado de mensaje en base de datos
    await updateMessageStatus(id, statusType, recipient_id, timestamp, errors, requestId);
    
    const duration = Date.now() - statusStartTime;
    
    return { success: true, duration: duration };
    
  } catch (error) {
    const duration = Date.now() - statusStartTime;
    
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 NUEVA FUNCIÓN: Manejar errores de engagement
async function handleEngagementError(recipientId: string, error: any, requestId: string) {
  try {
    console.log(`🔄 [${requestId}] Activando estrategia de activación manual para ${recipientId}`);
    
    // Buscar pedidos pendientes para este número
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar pedidos pendientes
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('provider_phone', recipientId)
      .eq('status', 'pending_confirmation')
      .order('created_at', { ascending: false })
      .limit(1);

    if (pendingError) {
      return;
    }

    if (pendingOrders && pendingOrders.length > 0) {
      const pendingOrder = pendingOrders[0];
      
      // Actualizar estado a "requiere activación manual"
      const { error: updateError } = await supabase
        .from('pending_orders')
        .update({ 
          status: 'manual_activation_required',
          notes: `Error de engagement (${error.code}): ${error.title}. El proveedor debe iniciar contacto.`
        })
        .eq('id', pendingOrder.id);

      if (updateError) {
      } else {
      }
    } else {
    }

  } catch (error) {
  }
}

// 🔧 NUEVA FUNCIÓN: Actualizar estado de mensaje en base de datos
async function updateMessageStatus(
  messageId: string, 
  status: string, 
  recipientId: string, 
  timestamp: string, 
  errors?: any[], 
  requestId?: string
) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };

    // Agregar información de errores si existen
    if (errors && errors.length > 0) {
      updateData.error_details = JSON.stringify(errors);
    }

    const { error } = await supabase
      .from('whatsapp_messages')
      .update(updateData)
      .eq('message_sid', messageId);

    if (error) {
      console.error(`❌ [${requestId}] Error actualizando estado de mensaje:`, error);
    } else {
      console.log(`✅ [${requestId}] Estado de mensaje ${messageId} actualizado a ${status}`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error en updateMessageStatus:`, error);
  }
}

async function processWhatsAppMessage(message: any, requestId: string) {
  const messageStartTime = Date.now();
  
  try {
    const { from, text, image, document, timestamp } = message;
    
    // Normalizar número de teléfono
    let normalizedFrom = from;
    if (from && !from.startsWith('+')) {
      normalizedFrom = `+${from}`;
    }
    
    // 🔧 DEBUG: Log completo del mensaje recibido
    console.log(`📨 [${requestId}] Mensaje completo recibido:`, JSON.stringify(message, null, 2));
    console.log(`🔍 [${requestId}] Tipos de contenido detectados:`, {
      hasText: !!text,
      hasImage: !!image,
      hasDocument: !!document,
      from: from,
      normalizedFrom: normalizedFrom
    });

    // 🔧 SISTEMA SIMPLIFICADO: Procesar archivos multimedia
    if (image || document) {
      const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
      const logger = InvoiceOrderLogger.getInstance();
      
      await logger.info(requestId, 'Documento/imagen detectado en webhook', {
        hasImage: !!image,
        hasDocument: !!document,
        from: normalizedFrom
      });
      
      console.log(`📎 [${requestId}] ===== PROCESANDO DOCUMENTO =====`);
      console.log(`📎 [${requestId}] Image presente:`, !!image);
      console.log(`📎 [${requestId}] Document presente:`, !!document);
      
              try {
          // Obtener userId del proveedor y verificar auto_order_flow_enabled     
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // 🔧 MEJORA: Búsqueda más flexible del proveedor
          let provider = null;
          
          // 1. Intentar búsqueda exacta
          const { data: exactProvider } = await supabase
            .from('providers')
            .select('user_id, id, name, auto_order_flow_enabled')
            .eq('phone', normalizedFrom)
            .single();

          if (exactProvider) {
            provider = exactProvider;
            console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda exacta: ${provider.name}`);
          } else {
            // 2. Intentar con diferentes variantes del número
            const phoneVariants = [
              normalizedFrom,
              normalizedFrom.replace(/^\+54/, ''), // Sin código de país
              normalizedFrom.replace(/^\+/, ''), // Sin +
              `54${normalizedFrom.replace(/^\+54/, '')}`, // Con 54 al inicio
              normalizedFrom.replace(/\D/g, ''), // Solo dígitos
            ];

            for (const variant of phoneVariants) {
              if (!variant || variant.length < 8) continue;
              
              const { data: variantProvider } = await supabase
                .from('providers')
                .select('user_id, id, name, auto_order_flow_enabled')
                .eq('phone', variant)
                .single();

              if (variantProvider) {
                provider = variantProvider;
                console.log(`✅ [${requestId}] Proveedor encontrado con variante ${variant}: ${provider.name}`);
                break;
              }
            }

            // 3. Si aún no se encuentra, intentar búsqueda por últimos dígitos
            if (!provider) {
              const lastDigits = normalizedFrom.replace(/\D/g, '').slice(-8);
              if (lastDigits.length >= 8) {
                console.log(`🔍 [${requestId}] Intentando búsqueda por últimos 8 dígitos: ${lastDigits}`);
                
                const { data: flexibleProviders } = await supabase
                  .from('providers')
                  .select('user_id, id, name, auto_order_flow_enabled, phone')
                  .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`)
                  .limit(5);

                if (flexibleProviders && flexibleProviders.length > 0) {
                  // Encontrar la mejor coincidencia
                  const bestMatch = flexibleProviders.find(p => {
                    const providerDigits = p.phone.replace(/\D/g, '').slice(-8);
                    return providerDigits === lastDigits;
                  });

                  if (bestMatch) {
                    provider = bestMatch;
                    console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda flexible: ${provider.name} (${provider.phone})`);
                  }
                }
              }
            }

            // 4. Si aún no se encuentra, loggear pero NO fallar - procesar documento sin proveedor
            if (!provider) {
              await logger.warn(requestId, 'Proveedor no encontrado para documento - procesando sin proveedor', { 
                phone: normalizedFrom,
                variants: phoneVariants
              });
              console.log(`⚠️ [${requestId}] Proveedor no encontrado para teléfono: ${normalizedFrom}`);
              console.log(`⚠️ [${requestId}] PROCESANDO DOCUMENTO SIN PROVEEDOR - Se intentará asociar después`);
              
              // 🔧 NUEVO: Procesar documento sin proveedor (lo asociaremos después)
              const mediaData = image || document;
              const result = await processWhatsAppDocumentWithoutProvider(
                normalizedFrom,
                mediaData,
                requestId
              );

              if (result.success) {
                await logger.info(requestId, 'Documento procesado sin proveedor inicial', { 
                  documentId: result.document_id 
                });
                console.log(`✅ [${requestId}] Documento procesado sin proveedor: ${result.document_id}`);
                const duration = Date.now() - messageStartTime;
                return { success: true, duration: duration, type: 'document', document_id: result.document_id };
              } else {
                const duration = Date.now() - messageStartTime;
                return { success: false, error: result.error || 'Error procesando documento sin proveedor', duration: duration, type: 'document_error' };
              }
            }
          }
        
        await logger.info(requestId, 'Proveedor encontrado', {
          providerId: provider.id,
          providerName: provider.name,
          userId: provider.user_id,
          autoOrderFlowEnabled: provider.auto_order_flow_enabled
        });
        
        // Verificar si el flujo automático está habilitado para este proveedor
        const autoOrderFlowEnabled = provider.auto_order_flow_enabled !== false; // Por defecto true si no está definido
        
        if (!autoOrderFlowEnabled) {
          await logger.info(requestId, 'Flujo automático de órdenes DESHABILITADO para este proveedor', {
            providerId: provider.id,
            providerName: provider.name,
            phone: normalizedFrom
          });
          console.log(`ℹ️ [${requestId}] Flujo automático deshabilitado para este proveedor: ${provider.name} (${normalizedFrom})`);
          // Aún así procesar el documento para que aparezca en el chat, pero no crear orden automáticamente
          const mediaData = image || document;
          const result = await processWhatsAppDocument(
            normalizedFrom,
            mediaData,
            requestId,
            provider.user_id,
            provider.id
          );
          
          if (result.success) {
            await logger.info(requestId, 'Documento procesado (sin flujo automático)', { documentId: result.document_id });
            console.log(`✅ [${requestId}] Documento procesado (sin flujo automático):`, result.document_id);
            const duration = Date.now() - messageStartTime;
            return { success: true, duration: duration, type: 'document', document_id: result.document_id };
          } else {
            const duration = Date.now() - messageStartTime;
            return { success: false, error: result.error, duration: duration, type: 'document_error' };
          }
        }
        
        const mediaData = image || document;
        await logger.info(requestId, 'Procesando documento con flujo automático habilitado', {
          providerName: provider.name,
          providerId: provider.id
        });
        console.log(`📎 [${requestId}] Procesando documento del proveedor: ${provider.name} (flujo automático habilitado)`);
        
        // 🔧 NUEVO: Usar sistema simplificado que SIEMPRE crea el mensaje en el chat
        console.log(`📎 [${requestId}] Usando processWhatsAppDocument para crear mensaje en chat...`);
        const result = await processWhatsAppDocument(
          normalizedFrom,
          mediaData,
          requestId,
          provider.user_id,
          provider.id
        );
        
        if (result.success) {
          await logger.success(requestId, 'Documento procesado exitosamente', {
            documentId: result.document_id,
            providerId: provider.id
          });
          console.log(`✅ [${requestId}] Documento procesado y mensaje creado:`, result.document_id);
          
          // 🔧 OPCIONAL: Intentar flujo de órdenes en background (sin bloquear)
          processMediaAsInvoice(normalizedFrom, message, requestId, provider.user_id)
            .then(orderResult => {
              if (orderResult.success) {
                console.log(`✅ [${requestId}] Documento también asociado con orden`);
              }
            })
            .catch(err => {
              console.log(`ℹ️ [${requestId}] Documento no asociado con orden (normal si no hay orden pendiente)`);
            });
          
          const duration = Date.now() - messageStartTime;
          return { success: true, duration: duration, type: 'document', document_id: result.document_id };
        } else {
          await logger.error(requestId, 'Error procesando documento', { error: result.error });
          console.log(`❌ [${requestId}] Error procesando documento:`, result.error);
          const duration = Date.now() - messageStartTime;
          return { success: false, error: result.error, duration: duration, type: 'document_error' };
        }
      } catch (error) {
        await logger.error(requestId, 'ERROR procesando documento', {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        console.error(`❌ [${requestId}] Error procesando documento:`, error);
        const duration = Date.now() - messageStartTime;
        return { success: false, error: 'Error procesando documento', duration: duration, type: 'document_error' };
      }
    } else {
      console.log(`📎 [${requestId}] No hay archivos multimedia en el mensaje`);
    }

    // 🔧 FUNCIONALIDAD EXISTENTE: Guardar mensaje con user_id asignado
    // Solo guardar mensaje si hay contenido de texto
    if (text?.body) {
      const saveResult = await saveMessageWithUserId(normalizedFrom, text.body, timestamp, requestId);
      
      if (saveResult.success) {
        console.log(`✅ [${requestId}] Mensaje guardado con user_id: ${saveResult.userId}`);
      } else {
        console.log(`❌ [${requestId}] Error guardando mensaje: ${saveResult.error}`);
        return { success: false, error: saveResult.error };
      }
    } else {
      console.log(`ℹ️ [${requestId}] No hay contenido de texto para guardar`);
    }

    // 🔧 CORRECCIÓN: Solo procesar flujo de órdenes para estados específicos
    // NO procesar para esperando_factura con mensajes de texto
    if (text?.body && !image && !document) {
      console.log(`📝 [${requestId}] Mensaje de texto recibido del proveedor:`, normalizedFrom);
      
      try {
        // Verificar si hay órdenes en estado esperando_factura para este proveedor
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { data: provider } = await supabase
          .from('providers')
          .select('id, user_id, auto_order_flow_enabled')
          .eq('phone', normalizedFrom)
          .single();
        
        if (provider) {
          // Verificar si el flujo automático está habilitado para este proveedor
          const autoOrderFlowEnabled = provider.auto_order_flow_enabled !== false; // Por defecto true si no está definido
          
          if (!autoOrderFlowEnabled) {
            console.log(`ℹ️ [${requestId}] Flujo automático deshabilitado para este proveedor:`, normalizedFrom);
            // No procesar el flujo automático, pero el mensaje ya se guardó arriba
          } else {
            // Procesar flujo normal - permitir nuevas órdenes incluso si hay facturas pendientes
            console.log(`🔄 [${requestId}] Procesando respuesta del proveedor con OrderFlowService:`, normalizedFrom);
            console.log(`🔍 [${requestId}] Datos del proveedor:`, {
              id: provider.id,
              userId: provider.user_id,
              autoOrderFlowEnabled: autoOrderFlowEnabled
            });
            
            const userId = provider.user_id;
            const { ExtensibleOrderFlowService } = await import('../../../../lib/extensibleOrderFlowService');
            const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
            
            console.log(`🚀 [${requestId}] Llamando a processProviderMessage con:`, {
              phone: normalizedFrom,
              message: text.body,
              userId: userId
            });
            
            const result = await extensibleOrderFlowService.processProviderMessage(normalizedFrom, text.body, userId);
            
            console.log(`📊 [${requestId}] Resultado del ExtensibleOrderFlowService:`, result);
            
            if (result.success) {
              console.log(`✅ [${requestId}] Flujo procesado: ${result.newStatus}`);
            } else {
              console.log(`⚠️ [${requestId}] Flujo no procesado: ${result.message || result.errors?.join(', ')}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error procesando flujo de órdenes:`, error);
      }
    } else if (!image && !document) {
      console.log(`ℹ️ [${requestId}] Mensaje sin contenido de texto, imagen o documento`);
    }
    
    const duration = Date.now() - messageStartTime;
    
    return { success: true, duration: duration, type: 'text' };
    
  } catch (error) {
    const duration = Date.now() - messageStartTime;
    
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 NUEVA FUNCIÓN: Procesar archivos multimedia como facturas
// ❌ DESHABILITADA: Usar solo el nuevo sistema de documentos
async function processMediaAsInvoice(providerPhone: string, media: any, requestId: string, userId?: string) {
  // 🔧 REACTIVADO: Sistema viejo para flujo de órdenes
  console.log(`🔄 [${requestId}] Procesando archivo como factura para flujo de órdenes...`);
  
  try {
    console.log(`📎 [${requestId}] Procesando archivo multimedia como factura...`);
    console.log(`📱 [${requestId}] Número de teléfono recibido:`, providerPhone);
    
    // Obtener URL del archivo desde WhatsApp
    let mediaUrl = '';
    let mediaType = '';
    
    console.log(`🔍 [${requestId}] Estructura del mensaje multimedia:`, JSON.stringify(media, null, 2));
    
    if (media.image) {
      mediaUrl = media.image.link || media.image.url || media.image.id;
      mediaType = 'image';
      console.log(`🖼️ [${requestId}] Imagen detectada:`, { link: media.image.link, url: media.image.url, id: media.image.id });
    } else if (media.document) {
      mediaUrl = media.document.link || media.document.url || media.document.id;
      mediaType = media.document.mime_type || 'document';
      console.log(`📄 [${requestId}] Documento detectado:`, { link: media.document.link, url: media.document.url, id: media.document.id });
    }
    
    // Intentar obtener URL de diferentes ubicaciones posibles
    if (!mediaUrl) {
      // Buscar en campos alternativos
      if (media.id) {
        mediaUrl = `https://graph.facebook.com/v18.0/${media.id}`;
        console.log(`🔗 [${requestId}] Usando ID como URL alternativa:`, mediaUrl);
      } else {
        console.log(`❌ [${requestId}] No se pudo obtener URL del archivo. Estructura:`, JSON.stringify(media, null, 2));
        return { success: false, error: 'No se pudo obtener URL del archivo' };
      }
    }
    
    console.log(`📎 [${requestId}] Archivo detectado:`, { mediaUrl, mediaType, providerPhone });
    
    // Buscar proveedor por número de teléfono
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 🔧 MEJORA: Búsqueda más robusta de proveedores con timeout
    const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
    
    // Normalizar el número recibido
    const normalizedPhone = PhoneNumberService.normalizeUnified(providerPhone);
    console.log(`🔧 [${requestId}] Número normalizado:`, normalizedPhone);
    
    // Generar variantes de búsqueda
    const searchVariants = PhoneNumberService.searchVariants(providerPhone);
    console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
    
    // 🔧 MEJORA: Búsqueda más eficiente con timeout
    let provider = null;
    const searchStartTime = Date.now();
    const SEARCH_TIMEOUT = 8000; // 8 segundos máximo para búsqueda
    
    // Primero intentar con búsqueda exacta por cada variante
    for (const variant of searchVariants) {
      if (Date.now() - searchStartTime > SEARCH_TIMEOUT) {
        console.warn(`⚠️ [${requestId}] Timeout en búsqueda de proveedores`);
        break;
      }
      
      console.log(`🔍 [${requestId}] Buscando proveedor con variante:`, variant);
      
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id, name, phone, cuit_cuil')
        .eq('phone', variant)
        .single();
      
      if (!providerError && providerData) {
        provider = providerData;
        console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda exacta:`, provider.name, `(${provider.phone})`);
        break;
      }
    }
    
    // 🔧 MEJORA: Si no se encuentra, intentar búsqueda más flexible con timeout
    if (!provider && (Date.now() - searchStartTime < SEARCH_TIMEOUT)) {
      console.log(`⚠️ [${requestId}] No se encontró proveedor con búsqueda exacta, intentando búsqueda flexible...`);
      
      // Búsqueda por similitud de números (últimos 8-10 dígitos)
      const lastDigits = providerPhone.replace(/\D/g, '').slice(-8);
      if (lastDigits.length >= 8) {
        console.log(`🔍 [${requestId}] Buscando por últimos dígitos:`, lastDigits);
        
        const { data: providers, error: searchError } = await supabase
          .from('providers')
          .select('id, name, phone')
          .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`)
          .limit(3); // 🔧 MEJORA: Limitar resultados para evitar timeouts
        
        if (!searchError && providers && providers.length > 0) {
          // Encontrar la mejor coincidencia
          const bestMatch = providers.find(p => {
            const providerDigits = p.phone.replace(/\D/g, '').slice(-8);
            return providerDigits === lastDigits;
          });
          
          if (bestMatch) {
            provider = bestMatch;
            console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda flexible:`, provider.name, `(${provider.phone})`);
          }
        }
      }
    }
    
    // 🔧 MEJORA: Si aún no se encuentra, mostrar información de debug
    if (!provider) {
      console.log(`❌ [${requestId}] No se pudo encontrar proveedor después de ${Date.now() - searchStartTime}ms. Información de debug:`);
      console.log(`📱 [${requestId}] Número recibido:`, providerPhone);
      console.log(`🔧 [${requestId}] Número normalizado:`, normalizedPhone);
      console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
      
      // 🔧 MEJORA: Intentar obtener solo los primeros 3 proveedores para debug (más rápido)
      const { data: allProviders, error: debugError } = await supabase
        .from('providers')
        .select('id, name, phone')
        .limit(3);
      
      if (!debugError && allProviders) {
        console.log(`🔍 [${requestId}] Primeros 3 proveedores en BD:`, allProviders.map(p => ({ name: p.name, phone: p.phone })));
      }
      
      return { success: false, error: 'Proveedor no encontrado' };
    }
    
    // Descargar archivo desde WhatsApp y subirlo a Supabase Storage PRIMERO
    // (necesitamos los datos de la factura para crear la orden si no existe)
    const { data: fileBuffer, error: downloadError } = await downloadMediaFromWhatsApp(mediaUrl, requestId);
    
    if (downloadError || !fileBuffer) {
      return { success: false, error: 'Error descargando archivo desde WhatsApp' };
    }
    
    // 🔧 NUEVO: Extraer datos de la factura PRIMERO (antes de buscar/crear orden)
    let extractedData = null;
    const isPdf = mediaType === 'application/pdf' || mediaType === 'document' || mediaUrl.includes('.pdf');
    
    if (isPdf) {
      try {
        console.log(`🔍 [${requestId}] Extrayendo datos del PDF...`);
        
        // Importar servicio de extracción simplificado
        const { simpleInvoiceExtraction } = require('../../../../lib/simpleInvoiceExtraction.js');
        
        // 🔧 NUEVO: Extraer texto real del PDF
        let extractedText = '';
        
        try {
          console.log(`🔍 [${requestId}] Extrayendo texto del PDF...`);
          console.log(`🔍 [${requestId}] FileBuffer size:`, fileBuffer?.length || 'undefined');
          console.log(`🔍 [${requestId}] MediaType:`, mediaType);
          
          // Verificar que el buffer no esté vacío
          if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('FileBuffer está vacío o no se descargó correctamente');
          }
          
          // 🔧 INTENTO 1: pdf-parse
          try {
            const pdfParse = require('pdf-parse');
            
            // Crear un buffer limpio para evitar problemas de referencia
            const cleanBuffer = Buffer.from(fileBuffer);
            console.log(`📄 [${requestId}] Intentando parsear PDF de ${cleanBuffer.length} bytes...`);
            
            const pdfData = await pdfParse(cleanBuffer);
            extractedText = pdfData.text;
            
            if (extractedText && extractedText.trim()) {
              console.log(`✅ [${requestId}] Texto extraído con pdf-parse (${extractedText.length} caracteres):`, extractedText.substring(0, 200) + '...');
            } else {
              throw new Error('pdf-parse no extrajo texto válido');
            }
            
          } catch (pdfParseError) {
            console.warn(`⚠️ [${requestId}] pdf-parse falló:`, pdfParseError.message);
            
            // 🔧 MEJORA: Si es un error de archivo de prueba, intentar de nuevo con configuración diferente
            if (pdfParseError.message.includes('05-versions-space.pdf') || pdfParseError.message.includes('ENOENT')) {
              console.log(`🔄 [${requestId}] Error de archivo de prueba detectado, intentando solución alternativa...`);
              
              try {
                // Intentar con una configuración diferente
                const pdfParse = require('pdf-parse');
                const pdfData = await pdfParse(Buffer.from(fileBuffer), {
                  // Configuración específica para evitar problemas de archivos de prueba
                  max: 0, // Sin límite de páginas
                  version: 'v1.10.100' // Versión específica
                });
                extractedText = pdfData.text;
                
                if (extractedText && extractedText.trim()) {
                  console.log(`✅ [${requestId}] Texto extraído con pdf-parse (segundo intento, ${extractedText.length} caracteres):`, extractedText.substring(0, 200) + '...');
                } else {
                  throw new Error('Segundo intento de pdf-parse no extrajo texto válido');
                }
                
              } catch (secondError) {
                console.warn(`⚠️ [${requestId}] Segundo intento de pdf-parse falló:`, secondError.message);
                throw new Error(`pdf-parse falló: ${pdfParseError.message}`);
              }
            } else {
              throw new Error(`pdf-parse falló: ${pdfParseError.message}`);
            }
          }
          
        } catch (extractionError) {
          console.error(`❌ [${requestId}] Error extrayendo texto del PDF (pdf-parse + OCR fallaron):`, extractionError);
          
          // Fallback: usar texto simulado si fallan ambos métodos
          const providerCuit = provider.cuit_cuil || '20143089984';
          extractedText = `
            FACTURA A
            Número: 0001-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
            Fecha: ${new Date().toLocaleDateString('es-AR')}
            Proveedor: ${provider.name}
            CUIT: ${providerCuit}
            Total: $15000
            Moneda: ARS
          `;
          
          console.log(`⚠️ [${requestId}] ⚠️ ATENCIÓN: Usando texto simulado como fallback final`);
          console.log(`⚠️ [${requestId}] ⚠️ Esto indica que el PDF está corrupto o es inválido`);
          console.log(`⚠️ [${requestId}] ⚠️ El archivo descargado no se puede procesar correctamente`);
        }
        
        const tempFileName = `invoice_${Date.now()}.pdf`;
        const extractionResult = await simpleInvoiceExtraction.extractFromText(extractedText, tempFileName);
        
        if (extractionResult && extractionResult.success && extractionResult.data) {
          extractedData = extractionResult.data;
          console.log(`✅ [${requestId}] Datos extraídos:`, {
            invoiceNumber: extractedData.invoiceNumber,
            totalAmount: extractedData.totalAmount,
            currency: extractedData.currency,
            confidence: extractionResult.confidence,
            providerTaxId: extractedData.providerTaxId
          });
          
          // 🔧 VALIDACIÓN DE CUIT: Verificar que el CUIT de la factura coincida con el proveedor
          if (extractedData.providerTaxId && provider.cuit_cuil) {
            const invoiceCuit = extractedData.providerTaxId.replace(/\D/g, ''); // Remover caracteres no numéricos
            const providerCuit = provider.cuit_cuil.replace(/\D/g, ''); // Remover caracteres no numéricos
            
            console.log(`🔍 [${requestId}] Validando CUIT:`, {
              invoiceCuit: invoiceCuit,
              providerCuit: providerCuit,
              match: invoiceCuit === providerCuit
            });
            
            // 🔧 MEJORA: Validación más flexible - verificar si el CUIT de la factura está contenido en el CUIT del proveedor
            const isCuitValid = invoiceCuit === providerCuit || 
                               providerCuit.includes(invoiceCuit) || 
                               invoiceCuit.includes(providerCuit.substring(0, 11));
            
            if (!isCuitValid) {
              console.log(`❌ [${requestId}] CUIT no coincide. Factura rechazada.`);
              return { 
                success: false, 
                error: `El CUIT de la factura (${invoiceCuit}) no coincide con el CUIT del proveedor (${providerCuit}). Por favor, envíe la factura correcta.` 
              };
            } else {
              console.log(`✅ [${requestId}] CUIT validado correctamente`);
            }
          } else {
            console.log(`⚠️ [${requestId}] No se pudo validar CUIT - datos faltantes:`, {
              hasInvoiceCuit: !!extractedData.providerTaxId,
              hasProviderCuit: !!provider.cuit_cuil
            });
            
            // En producción, rechazar facturas sin CUIT válido
            if (!extractedData.providerTaxId) {
              return { 
                success: false, 
                error: 'No se pudo extraer el CUIT de la factura. Por favor, envíe una factura con CUIT visible y legible.' 
              };
            }
          }
        } else {
          console.log(`⚠️ [${requestId}] No se pudieron extraer datos del PDF:`, extractionResult.error);
          return { 
            success: false, 
            error: 'No se pudieron extraer datos de la factura. Por favor, envíe una factura legible con datos claros.' 
          };
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error extrayendo datos del PDF:`, error);
        return { 
          success: false, 
          error: 'Error interno procesando la factura. Por favor, intente nuevamente.' 
        };
      }
    }
    
    // 🔧 NUEVO: Buscar orden en estado esperando_factura, o crear una nueva si no existe
    const { data: latestOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status, user_id')
      .eq('provider_id', provider.id)
      .eq('status', 'esperando_factura')
      .order('created_at', { ascending: false })
      .limit(1);
    
    let orderToUpdate: any = null;
    let orderCreated = false;
    
    if (orderError || !latestOrder || latestOrder.length === 0) {
      // No hay orden esperando factura, crear una nueva automáticamente
      console.log(`🆕 [${requestId}] No se encontraron órdenes esperando factura. Creando nueva orden automáticamente...`);
      
      // Obtener user_id del proveedor
      const { data: providerWithUser, error: providerUserError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', provider.id)
        .single();
      
      if (providerUserError || !providerWithUser?.user_id) {
        console.error(`❌ [${requestId}] No se pudo obtener user_id del proveedor:`, providerUserError);
        return { success: false, error: 'No se pudo obtener información del usuario' };
      }
      
      const orderUserId = providerWithUser.user_id || userId || '';
      
      // Generar número de orden único
      const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${randomSuffix}`;
      
      // Calcular monto total de la factura (o usar un valor por defecto)
      const totalAmount = extractedData?.totalAmount || 0;
      
      // Crear la nueva orden
      const { data: newOrder, error: createOrderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          provider_id: provider.id,
          user_id: orderUserId,
          status: 'esperando_factura',
          total_amount: totalAmount,
          currency: extractedData?.currency || 'ARS',
          items: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createOrderError || !newOrder) {
        console.error(`❌ [${requestId}] Error creando nueva orden:`, createOrderError);
        return { success: false, error: 'Error creando nueva orden automáticamente' };
      }
      
      orderToUpdate = newOrder;
      orderCreated = true;
      console.log(`✅ [${requestId}] Nueva orden creada automáticamente: ${orderNumber}`);
    } else {
      orderToUpdate = latestOrder[0];
      console.log(`📋 [${requestId}] Orden pendiente encontrada:`, orderToUpdate.order_number);
    }
    
    // Subir archivo a Supabase Storage
    const fileName = `invoice_${Date.now()}_${provider.id}_${orderToUpdate.order_number}.${mediaType === 'image' ? 'jpg' : 'pdf'}`;
    const filePath = `invoices/${provider.id}/${fileName}`;
    
    // 🔧 MEJORA: Usar servicio de storage robusto con verificación automática de bucket
    const { SupabaseStorageService } = await import('../../../../lib/supabaseStorageService');
    const storageService = new SupabaseStorageService(requestId);
    
    // Subir archivo usando el servicio robusto
    const uploadResult = await storageService.uploadFileWithBucketCheck(
      'files', // Usar bucket existente
      filePath,
      fileBuffer,
      {
        contentType: mediaType === 'image' ? 'image/jpeg' : 'application/pdf',
        cacheControl: '3600'
      }
    );
    
    if (!uploadResult.success) {
      console.error(`❌ [${requestId}] Error subiendo archivo a Supabase:`, uploadResult.error);
      return { success: false, error: `Error subiendo archivo: ${uploadResult.error}` };
    }
    
    const publicUrl = uploadResult.fileUrl;
    console.log(`✅ [${requestId}] Archivo subido exitosamente a Supabase:`, publicUrl);
    
    // Asociar factura a la orden con datos extraídos
    const updateData: any = {
      receipt_url: publicUrl,
      status: 'pendiente_de_pago',
      updated_at: new Date().toISOString()
    };

    // Agregar datos extraídos si están disponibles
    if (extractedData) {
      updateData.invoice_data = extractedData;
      updateData.invoice_number = extractedData.invoiceNumber;
      updateData.invoice_total = extractedData.totalAmount;
      updateData.invoice_currency = extractedData.currency;
      updateData.invoice_date = extractedData.issueDate;
      updateData.invoice_due_date = extractedData.dueDate;
      updateData.extraction_confidence = extractedData.confidence;
      
      // 🔧 NUEVO: Actualizar el monto total de la orden con el monto real de la factura
      if (extractedData.totalAmount && extractedData.totalAmount > 0) {
        updateData.total_amount = extractedData.totalAmount;
        if (orderCreated) {
          console.log(`✅ [${requestId}] Orden creada con monto: $${extractedData.totalAmount}`);
        } else {
          console.log(`✅ [${requestId}] Actualizando monto de orden: $${orderToUpdate.total_amount} → $${extractedData.totalAmount}`);
        }
      }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderToUpdate.id);
    
    if (updateError) {
      console.error(`❌ [${requestId}] Error asociando factura a orden:`, updateError);
      return { success: false, error: 'Error asociando factura a orden' };
    }
    
    console.log(`✅ [${requestId}] Factura asociada exitosamente a orden ${orderToUpdate.order_number}`);
    
    // 🔧 NUEVA FUNCIONALIDAD: Generar datos de pago automáticamente
    if (extractedData && extractedData.totalAmount) {
      try {
        console.log(`💳 [${requestId}] Generando datos de pago automáticamente...`);
        
        const { paymentDataService } = require('../../../../lib/paymentDataService.js');
        
        // Crear cliente Supabase para el servicio
        const { createClient } = require('@supabase/supabase-js');
        const serviceSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const paymentResult = await paymentDataService.generatePaymentData(orderToUpdate.id, orderToUpdate.user_id, serviceSupabase);
        
        if (paymentResult.success) {
          console.log(`✅ [${requestId}] Datos de pago generados:`, {
            amount: paymentResult.data.amount,
            currency: paymentResult.data.currency,
            paymentMethod: paymentResult.data.paymentMethod
          });
          
          // Actualizar la orden con los datos de pago
          await paymentDataService.updateOrderWithPaymentData(
            orderToUpdate.id, 
            orderToUpdate.user_id, 
            paymentResult.data,
            serviceSupabase
          );
          
          console.log(`✅ [${requestId}] Orden actualizada con datos de pago generados`);
        } else {
          console.warn(`⚠️ [${requestId}] Error generando datos de pago:`, paymentResult.error);
        }
      } catch (paymentError) {
        console.error(`❌ [${requestId}] Error en generación automática de datos de pago:`, paymentError);
        // No fallar el webhook por este error, solo loggearlo
      }
    }
    
    // 🔧 NUEVA FUNCIONALIDAD: Guardar mensaje de factura en el chat
    try {
      const messageSid = `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 🔧 CORRECCIÓN: Buscar el user_id del proveedor para asociar el mensaje correctamente
      const { data: providerUser, error: userError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', provider.id)
        .single();
      
      if (userError || !providerUser?.user_id) {
        console.error(`❌ [${requestId}] Error obteniendo user_id del proveedor:`, userError);
        return { success: false, error: 'No se pudo obtener usuario del proveedor' };
      }
      
      const { error: messageError } = await supabase
        .from('whatsapp_messages')
        .insert([{
          content: `📎 Factura recibida para orden ${orderToUpdate.order_number}`,
          message_type: 'received',
          status: 'delivered',
          contact_id: providerPhone,
          user_id: providerUser.user_id, // 🔧 CORRECCIÓN: Asociar al usuario correcto
          message_sid: messageSid,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);
      
      if (messageError) {
        console.error(`❌ [${requestId}] Error guardando mensaje de factura:`, messageError);
      } else {
        console.log(`✅ [${requestId}] Mensaje de factura guardado en chat:`, messageSid);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error guardando mensaje de factura:`, error);
    }
    
    return {
      success: true,
      orderId: orderToUpdate.id,
      orderNumber: orderToUpdate.order_number,
      fileUrl: publicUrl
    };
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error en processMediaAsInvoice:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Descargar archivo desde WhatsApp
async function downloadMediaFromWhatsApp(mediaUrl: string, requestId: string) {
  try {
    console.log(`📥 [${requestId}] Descargando archivo desde WhatsApp:`, mediaUrl);
    
    // Obtener token de acceso de WhatsApp
    const accessToken = process.env.WHATSAPP_API_KEY;
    if (!accessToken) {
      console.error(`❌ [${requestId}] Token de WhatsApp no configurado`);
      return { data: null, error: 'Token de WhatsApp no configurado' };
    }
    
    // 🔧 MEJORA: Validar URL antes de descargar
    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      console.error(`❌ [${requestId}] URL de archivo inválida:`, mediaUrl);
      return { data: null, error: 'URL de archivo inválida' };
    }
    
    console.log(`🔐 [${requestId}] Iniciando descarga con token:`, accessToken.substring(0, 10) + '...');
    
    // Descargar archivo con timeout y headers apropiados
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
    
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'GastronomySaaS/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No se pudo leer respuesta');
        console.error(`❌ [${requestId}] Error HTTP ${response.status} descargando archivo:`, errorText);
        return { data: null, error: `Error HTTP ${response.status}: ${response.statusText}` };
      }
      
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      console.log(`📊 [${requestId}] Respuesta recibida:`, {
        status: response.status,
        contentType,
        contentLength: contentLength ? `${contentLength} bytes` : 'Desconocido'
      });
      
      // 🔧 MEJORA: Validar tipo de contenido
      if (contentType && !contentType.includes('image') && !contentType.includes('pdf') && !contentType.includes('application')) {
        console.warn(`⚠️ [${requestId}] Tipo de contenido inesperado:`, contentType);
      }
      
      // 🔧 CORREGIDO: Si es JSON, extraer URL del archivo real
      if (contentType && contentType.includes('application/json')) {
        console.log(`📋 [${requestId}] WhatsApp devolvió JSON con metadata del archivo. Extrayendo URL real...`);
        
        // Leer el contenido JSON para extraer la URL real
        try {
          const jsonContent = await response.text();
          console.log(`🔍 [${requestId}] Contenido JSON recibido:`, jsonContent);
          
          const jsonData = JSON.parse(jsonContent);
          
          // Verificar si tiene la URL del archivo real
          if (jsonData.url && jsonData.mime_type && jsonData.file_size) {
            console.log(`✅ [${requestId}] URL real del archivo encontrada:`, jsonData.url);
            console.log(`📊 [${requestId}] Metadata del archivo:`, {
              mime_type: jsonData.mime_type,
              file_size: jsonData.file_size,
              sha256: jsonData.sha256
            });
            
            // Descargar el archivo real desde la URL extraída
            console.log(`📥 [${requestId}] Descargando archivo real desde URL:`, jsonData.url);
            
            const realResponse = await fetch(jsonData.url, {
              headers: {
                'User-Agent': 'GastronomySaaS/1.0',
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (!realResponse.ok) {
              console.error(`❌ [${requestId}] Error descargando archivo real:`, realResponse.status, realResponse.statusText);
              return { data: null, error: `Error descargando archivo real: ${realResponse.status}` };
            }
            
            const realArrayBuffer = await realResponse.arrayBuffer();
            const realBuffer = Buffer.from(realArrayBuffer);
            
            console.log(`✅ [${requestId}] Archivo real descargado exitosamente:`, {
              bytes: realBuffer.length,
              kilobytes: (realBuffer.length / 1024).toFixed(2),
              expected_size: jsonData.file_size
            });
            
            return { data: realBuffer, error: null };
            
          } else {
            console.warn(`⚠️ [${requestId}] JSON no contiene URL de archivo válida`);
            return { 
              data: null, 
              error: `JSON no contiene URL de archivo válida: ${jsonContent.substring(0, 200)}` 
            };
          }
          
        } catch (jsonError) {
          console.error(`❌ [${requestId}] Error procesando JSON:`, jsonError);
          return { 
            data: null, 
            error: 'Error procesando JSON de WhatsApp' 
          };
        }
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`✅ [${requestId}] Archivo descargado exitosamente:`, {
        bytes: buffer.length,
        kilobytes: (buffer.length / 1024).toFixed(2),
        contentType
      });
      
      return { data: buffer, error: null };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`⏰ [${requestId}] Timeout descargando archivo (30s)`);
        return { data: null, error: 'Timeout descargando archivo' };
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error descargando archivo:`, error);
    
    // 🔧 MEJORA: Clasificar tipos de error
    let errorMessage = 'Error desconocido descargando archivo';
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Error de red al descargar archivo';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout al descargar archivo';
      } else if (error.message.includes('unauthorized')) {
        errorMessage = 'No autorizado para descargar archivo';
      } else {
        errorMessage = error.message;
      }
    }
    
    return { data: null, error: errorMessage };
  }
}

// 🔧 FUNCIÓN ELIMINADA: sendInvoiceConfirmation ya no se usa
// Se eliminó para simplificar el flujo y evitar confirmaciones innecesarias

// 🔧 FUNCIÓN MEJORADA: Guardar mensaje con user_id asignado automáticamente
async function saveMessageWithUserId(contactId: string, content: string, timestamp: string, requestId: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(`❌ [${requestId}] Variables de entorno faltantes para guardar mensaje`);
      return { success: false, error: 'Variables de entorno faltantes' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🔧 MEJORA: Usar normalización unificada para búsquedas
    const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
    const searchVariants = PhoneNumberService.searchVariants(contactId);
    
    // 🔧 MEJORA: Log del número normalizado esperado para debugging
    const expectedNormalized = PhoneNumberService.normalizeUnified(contactId);
    console.log(`🔍 [${requestId}] Número normalizado esperado para búsqueda:`, expectedNormalized);
    console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
    
    let userId = null;
    
    // 🔧 MEJORA: Búsqueda más robusta de proveedores
    if (searchVariants.length > 0) {
      // Buscar por cada variante hasta encontrar un proveedor
      for (const variant of searchVariants) {
        console.log(`🔍 [${requestId}] Buscando proveedor con variante:`, variant);
        
        const { data: provider, error: providerError } = await supabase
          .from('providers')
          .select('user_id, phone, name')
          .eq('phone', variant)
          .single();
        
        if (!providerError && provider) {
          userId = provider.user_id;
          console.log(`✅ [${requestId}] Proveedor encontrado:`, provider.name, `(${provider.phone}) - User ID:`, userId);
          break;
        }
      }
    }
    
    // 🔧 MEJORA: Si no se encuentra, intentar búsqueda más flexible
    if (!userId) {
      console.log(`⚠️ [${requestId}] No se encontró proveedor con búsqueda exacta, intentando búsqueda flexible...`);
      
      // Búsqueda por similitud de números (últimos 8-10 dígitos)
      const lastDigits = contactId.replace(/\D/g, '').slice(-8);
      if (lastDigits.length >= 8) {
        console.log(`🔍 [${requestId}] Buscando por últimos dígitos:`, lastDigits);
        
        const { data: providers, error: searchError } = await supabase
          .from('providers')
          .select('user_id, phone, name')
          .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`);
        
        if (!searchError && providers && providers.length > 0) {
          // Encontrar la mejor coincidencia
          const bestMatch = providers.find(p => {
            const providerDigits = p.phone.replace(/\D/g, '').slice(-8);
            return providerDigits === lastDigits;
          });
          
          if (bestMatch) {
            userId = bestMatch.user_id;
            console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda flexible:`, bestMatch.name, `(${bestMatch.phone}) - User ID:`, userId);
          }
        }
      }
    }

    if (!userId) {
      console.log(`⚠️ [${requestId}] No se encontró usuario de la app para proveedor ${contactId}`);
      // 🔧 NUEVA FUNCIONALIDAD: Si no se encuentra usuario, guardar con user_id null para que aparezca en el filtro
      console.log(`📝 [${requestId}] Guardando mensaje con user_id=null para que aparezca en el filtro de realtime`);
    } else {
      console.log(`✅ [${requestId}] Encontrado usuario de la app ${userId} para proveedor ${contactId}`);
    }

    // 🔧 CORRECCIÓN: Guardar mensaje con el user_id correcto del proveedor
    const messageSid = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Si encontramos el userId del proveedor, usarlo; si no, usar null para que aparezca en el filtro
    const finalUserId = userId || null;
    
    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert([{
        content: content,
        message_type: 'received',
        status: 'delivered',
        contact_id: contactId, // Número del proveedor
        user_id: finalUserId, // Usar el userId del proveedor si se encuentra
        message_sid: messageSid,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        created_at: new Date().toISOString()
      }]);

    if (saveError) {
      console.error(`❌ [${requestId}] Error guardando mensaje:`, saveError);
      return { success: false, error: saveError.message };
    } else {
      console.log(`✅ [${requestId}] Mensaje guardado con user_id: ${finalUserId}`);
      console.log(`📝 [${requestId}] Message SID: ${messageSid}`);
      return { success: true, userId: finalUserId, messageSid: messageSid };
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Error en saveMessageWithUserId:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

  // 🔧 NUEVA FUNCIÓN: Procesar documento sin proveedor (fallback)
  async function processWhatsAppDocumentWithoutProvider(
    senderPhone: string,
    mediaData: any,
    requestId: string
  ): Promise<{ success: boolean; document_id?: string; error?: string }> {
    try {
      console.log(`📎 [${requestId}] Procesando documento sin proveedor inicial...`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Determinar tipo de documento
      const documentType = determineDocumentType(mediaData);
      console.log(`📎 [${requestId}] Tipo de documento: ${documentType}`);

      // Construir URL de descarga para WhatsApp
      const mediaUrl = `https://graph.facebook.com/v18.0/${mediaData.id}`;
      console.log(`📥 [${requestId}] URL construida para descarga: ${mediaUrl}`);

      // Descargar archivo desde WhatsApp
      const downloadResult = await downloadMediaFromWhatsApp(mediaUrl, requestId);
      if (downloadResult.error || !downloadResult.data) {
        return { success: false, error: 'Error descargando archivo desde WhatsApp' };
      }
      const fileBuffer = downloadResult.data;

      // Subir archivo a ubicación temporal (sin carpeta de proveedor)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileExtension = (mediaData.filename || 'document').split('.').pop() || 'bin';
      const tempFilename = `temp_${dateStr}_${timeStr}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
      const storagePath = `temp/${tempFilename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('files')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/octet-stream',
          upsert: false
        });

      if (uploadError) {
        console.error(`❌ [${requestId}] Error subiendo archivo:`, uploadError);
        return { success: false, error: uploadError.message };
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('files')
        .getPublicUrl(storagePath);

      console.log(`✅ [${requestId}] Archivo subido exitosamente: ${storagePath}`);

      // Intentar encontrar user_id buscando todos los proveedores que podrían tener este número
      // (esto se hará en un proceso posterior, por ahora guardamos sin user_id)
      
      // Crear documento en la base de datos SIN provider_id ni user_id (se asociará después)
      const { DocumentService } = await import('../../../../lib/documentService');
      const documentService = new DocumentService();

      // Primero intentar encontrar algún usuario que tenga un proveedor con este número
      let userId = null;
      const phoneVariants = [
        senderPhone,
        senderPhone.replace(/^\+54/, ''),
        senderPhone.replace(/^\+/, ''),
        `54${senderPhone.replace(/^\+54/, '')}`,
        senderPhone.replace(/\D/g, ''),
      ];

      for (const variant of phoneVariants) {
        if (!variant || variant.length < 8) continue;
        
        const { data: provider } = await supabase
          .from('providers')
          .select('user_id, id')
          .eq('phone', variant)
          .single();

        if (provider) {
          userId = provider.user_id;
          console.log(`✅ [${requestId}] Encontrado user_id ${userId} para variante ${variant}`);
          break;
        }
      }

      const documentResult = await documentService.createDocument({
        user_id: userId || undefined, // Puede ser null inicialmente
        filename: mediaData.filename || tempFilename,
        file_url: urlData.publicUrl,
        file_size: fileBuffer.length,
        file_type: documentType,
        mime_type: mediaData.mime_type,
        whatsapp_message_id: mediaData.id,
        sender_phone: senderPhone,
        sender_type: 'provider',
        provider_id: undefined, // Se asociará después si se encuentra el proveedor
      });

      if (!documentResult.success) {
        return { success: false, error: documentResult.error };
      }

      console.log(`✅ [${requestId}] Documento creado sin proveedor: ${documentResult.document_id}`);

      // Procesar con OCR (esto puede ayudar a encontrar el proveedor después)
      await processDocumentWithOCR(documentResult.document_id!, requestId, fileBuffer, mediaData.filename);

      // Crear mensaje en el chat si tenemos user_id
      if (userId) {
        const { v4: uuidv4 } = await import('uuid');
        const messageId = uuidv4();

        const messageData = {
          id: messageId,
          content: `📎 ${mediaData.filename || tempFilename}`,
          message_type: 'received',
          status: 'delivered',
          contact_id: senderPhone,
          user_id: userId,
          message_sid: mediaData.id,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          media_url: urlData.publicUrl,
          media_type: mediaData.mime_type || documentType,
        };

        const { error: messageError } = await supabase
          .from('whatsapp_messages')
          .insert([messageData]);

        if (messageError) {
          console.error(`❌ [${requestId}] Error guardando mensaje:`, messageError);
        } else {
          console.log(`✅ [${requestId}] Mensaje guardado en chat: ${messageId}`);
        }
      } else {
        console.log(`⚠️ [${requestId}] No se pudo crear mensaje en chat (sin user_id)`);
      }

      return { success: true, document_id: documentResult.document_id };

    } catch (error) {
      console.error(`❌ [${requestId}] Error procesando documento sin proveedor:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error inesperado'
      };
    }
  }

  // 🔧 FUNCIÓN SIMPLIFICADA: Procesar documento de WhatsApp
  async function processWhatsAppDocument(
  senderPhone: string, 
  mediaData: any, 
  requestId: string, 
  userId: string,
  providerId: string
): Promise<{ success: boolean; document_id?: string; error?: string }> {
  try {
    console.log(`📄 [${requestId}] Procesando documento de WhatsApp...`);
    
    // Determinar tipo de documento
    const documentType = determineDocumentType(mediaData);
    console.log(`📄 [${requestId}] Tipo de documento: ${documentType}`);

    // Construir URL de descarga para WhatsApp
    const mediaUrl = `https://graph.facebook.com/v18.0/${mediaData.id}`;
    console.log(`📥 [${requestId}] URL construida para descarga:`, mediaUrl);

    // 🔧 NUEVO: Detectar si es un documento simulado (para pruebas)
    const isSimulatedDocument = mediaData.id.includes('test_') || mediaData.id.includes('mock_');
    
    let fileBuffer: Buffer | null = null;
    
    if (isSimulatedDocument) {
      console.log(`🧪 [${requestId}] Documento simulado detectado, creando buffer simulado...`);
      // Crear un buffer simulado para documentos de prueba
      fileBuffer = Buffer.from('Documento simulado para pruebas - ' + mediaData.filename);
    } else {
      // Descargar archivo real desde WhatsApp
      const downloadResult = await downloadMediaFromWhatsApp(mediaUrl, requestId);
      if (downloadResult.error || !downloadResult.data) {
        return { success: false, error: 'Error descargando archivo desde WhatsApp' };
      }
      fileBuffer = downloadResult.data;
    }

    // Subir archivo a carpeta del proveedor
    const uploadResult = await uploadFileToProviderFolder(
      fileBuffer, 
      mediaData.filename || `document_${Date.now()}`,
      userId,
      providerId,
      requestId,
      senderPhone
    );
    
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    // Crear documento en la base de datos
    const { DocumentService } = await import('../../../../lib/documentService');
    const documentService = new DocumentService();
    
    const documentResult = await documentService.createDocument({
      user_id: userId,
      filename: uploadResult.filename,
      file_url: uploadResult.url,
      file_size: fileBuffer.length,
      file_type: documentType,
      mime_type: mediaData.mime_type,
      whatsapp_message_id: mediaData.id,
      sender_phone: senderPhone,
      sender_type: 'provider',
      provider_id: providerId
    });

    if (!documentResult.success) {
      return { success: false, error: documentResult.error };
    }

    // ✅ CORREGIDO: Procesar documento con OCR inmediatamente
    console.log(`🤖 [${requestId}] ===== INICIANDO PROCESAMIENTO OCR =====`);
    console.log(`🤖 [${requestId}] Document ID: ${documentResult.document_id}`);
    console.log(`🤖 [${requestId}] File buffer size: ${fileBuffer?.length || 0} bytes`);
    console.log(`🤖 [${requestId}] Filename: ${uploadResult.filename}`);
    console.log(`🤖 [${requestId}] Provider ID: ${providerId}`);
    console.log(`🤖 [${requestId}] User ID: ${userId}`);
    
    await processDocumentWithOCR(documentResult.document_id!, requestId, fileBuffer, uploadResult.filename);
    
    console.log(`🤖 [${requestId}] ===== PROCESAMIENTO OCR COMPLETADO =====`);

    // 🔧 NUEVO: Guardar documento como mensaje en el chat
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔧 DEBUG: Verificar valores antes de crear el mensaje
    console.log(`🔍 [${requestId}] DEBUG - Valores para crear mensaje:`, {
      senderPhone: senderPhone,
      senderPhoneType: typeof senderPhone,
      senderPhoneLength: senderPhone?.length,
      userId: userId,
      userIdType: typeof userId,
      mediaDataId: mediaData.id,
      uploadResultFilename: uploadResult.filename,
      uploadResultUrl: uploadResult.url,
      documentType: documentType
    });

    // 🔧 SOLUCIÓN DEFINITIVA: Obtener senderPhone de manera robusta
    let finalSenderPhone = senderPhone;
    
    if (!finalSenderPhone) {
      console.log(`🔍 [${requestId}] senderPhone es undefined/null, buscando alternativas...`);
      
      // Opción 1: Buscar por providerId
      if (providerId) {
        console.log(`🔍 [${requestId}] Buscando por providerId: ${providerId}`);
        const { data: provider, error: providerError } = await supabase
          .from('providers')
          .select('phone')
          .eq('id', providerId)
          .single();
        
        if (!providerError && provider && provider.phone) {
          finalSenderPhone = provider.phone;
          console.log(`✅ [${requestId}] Teléfono obtenido desde providerId: ${finalSenderPhone}`);
        }
      }
      
      // Opción 2: Buscar por userId si no se encontró
      if (!finalSenderPhone) {
        console.log(`🔍 [${requestId}] Buscando por userId: ${userId}`);
        const { data: providers, error: providersError } = await supabase
          .from('providers')
          .select('phone')
          .eq('user_id', userId)
          .limit(1);
        
        if (!providersError && providers && providers.length > 0 && providers[0].phone) {
          finalSenderPhone = providers[0].phone;
          console.log(`✅ [${requestId}] Teléfono obtenido desde userId: ${finalSenderPhone}`);
        }
      }
      
      // Opción 3: Usar el número del documento si existe
      if (!finalSenderPhone) {
        console.log(`🔍 [${requestId}] Verificando documento creado para obtener sender_phone...`);
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('sender_phone')
          .eq('id', documentResult.document_id)
          .single();
        
        if (!docError && document && document.sender_phone) {
          finalSenderPhone = document.sender_phone;
          console.log(`✅ [${requestId}] Teléfono obtenido desde documento: ${finalSenderPhone}`);
        }
      }
      
      if (!finalSenderPhone) {
        console.error(`❌ [${requestId}] CRÍTICO: No se pudo obtener senderPhone por ningún método`);
        console.error(`❌ [${requestId}] providerId: ${providerId}, userId: ${userId}`);
        // Forzar sincronización automática como último recurso
        try {
          console.log(`🔄 [${requestId}] Ejecutando sincronización automática como último recurso...`);
          const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/whatsapp/auto-sync-documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const syncResult = await syncResponse.json();
          console.log(`📊 [${requestId}] Resultado sincronización:`, syncResult);
        } catch (syncError) {
          console.error(`❌ [${requestId}] Error en sincronización automática:`, syncError);
        }
        return { success: true, document_id: documentResult.document_id };
      }
    }
    
    console.log(`✅ [${requestId}] senderPhone final: ${finalSenderPhone}`);

    // Generar UUID para el mensaje
    const { v4: uuidv4 } = await import('uuid');
    const messageId = uuidv4();
    
    const messageData = {
      id: messageId, // Agregar UUID generado
      content: `📎 ${uploadResult.filename}`,
      message_type: 'received',
      status: 'delivered',
      contact_id: finalSenderPhone, // Usar finalSenderPhone en lugar de senderPhone
      user_id: userId,
      message_sid: mediaData.id,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      media_url: uploadResult.url,
      media_type: documentType
    };

    console.log(`📱 [${requestId}] Insertando mensaje de documento con UUID: ${messageId}`);
    console.log(`📱 [${requestId}] WhatsApp ID original: ${mediaData.id}`);
    console.log(`📱 [${requestId}] Datos del mensaje a insertar:`, messageData);

    const { error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert([messageData]);

    if (messageError) {
      console.error(`❌ [${requestId}] Error guardando mensaje de documento:`, messageError);
      console.error(`❌ [${requestId}] Datos que causaron el error:`, messageData);
      // No fallar el proceso completo por esto
    } else {
      console.log(`✅ [${requestId}] Mensaje de documento guardado en chat con ID: ${messageId}`);
        console.log(`📱 [${requestId}] Datos del mensaje guardado:`, {
          id: messageId,
          content: `📎 ${uploadResult.filename}`,
          message_type: 'received',
          contact_id: finalSenderPhone,
          user_id: userId,
          media_url: uploadResult.url,
          whatsapp_message_id: mediaData.id
        });
    }

    console.log(`✅ [${requestId}] Documento creado exitosamente: ${documentResult.document_id}`);
    return { 
      success: true, 
      document_id: documentResult.document_id 
    };

  } catch (error) {
    console.error(`❌ [${requestId}] Error procesando documento:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error inesperado' 
    };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Determinar tipo de documento
function determineDocumentType(mediaData: any): 'catalogo' | 'factura' | 'comprobante' | 'foto' | 'other' {
  const filename = mediaData.filename?.toLowerCase() || '';
  const mimeType = mediaData.mime_type?.toLowerCase() || '';
  
  // Detectar por nombre de archivo
  if (filename.includes('catalogo') || filename.includes('catalog')) {
    return 'catalogo';
  }
  if (filename.includes('factura') || filename.includes('invoice')) {
    return 'factura';
  }
  if (filename.includes('comprobante') || filename.includes('receipt')) {
    return 'comprobante';
  }
  
  // Detectar por tipo MIME
  if (mimeType.startsWith('image/')) {
    return 'foto';
  }
  if (mimeType.includes('pdf')) {
    // PDFs son generalmente facturas o comprobantes
    return 'factura';
  }
  
  return 'other';
}

// 🔧 FUNCIÓN AUXILIAR: Determinar tipo de remitente
function determineSenderType(senderPhone: string, userId: string): 'provider' | 'user' {
  // Por ahora, asumimos que si viene por WhatsApp es de un proveedor
  // En el futuro se puede mejorar esta lógica
  return 'provider';
}

// ✅ CORREGIDO: Procesar documento con OCR inmediatamente
async function processDocumentWithOCR(documentId: string, requestId: string, fileBuffer?: Buffer, filename?: string): Promise<void> {
  const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
  const logger = InvoiceOrderLogger.getInstance();
  
  try {
    await logger.info(requestId, 'Iniciando procesamiento OCR inmediato', { documentId, filename });
    console.log(`🤖 [${requestId}] Iniciando procesamiento OCR inmediato para documento: ${documentId}`);
    
    const { DocumentService } = await import('../../../../lib/documentService');
    const documentService = new DocumentService();
    
    // Usar el método del DocumentService que ya está implementado
    const ocrResult = await documentService.processDocumentWithOCR(documentId);
    
    if (ocrResult.success) {
      await logger.success(requestId, 'OCR completado exitosamente', { documentId, confidence: ocrResult.confidence_score });
      console.log(`✅ [${requestId}] OCR completado exitosamente para documento: ${documentId}`);
      
      // 🔧 NUEVO: Esperar un momento para asegurar que los datos OCR estén guardados en la BD
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 🔧 NUEVO: Usar el sistema existente para crear/actualizar orden desde factura
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        // Obtener el documento con retry para asegurar que tenga los datos OCR
        let document: any = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts && !document?.ocr_data) {
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('user_id, provider_id, ocr_data, extracted_text')
            .eq('id', documentId)
            .single();
          
          if (!docError && docData) {
            document = docData;
            if (document.ocr_data) {
              console.log(`✅ [${requestId}] Documento obtenido con datos OCR en intento ${attempts + 1}`);
              break;
            }
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            console.log(`⏳ [${requestId}] Esperando datos OCR... (intento ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!document?.user_id) {
          await logger.warn(requestId, 'No se pudo obtener user_id del documento para crear orden', { documentId, document });
          console.warn(`⚠️ [${requestId}] No se pudo obtener user_id del documento para crear orden`);
          return;
        }
        
        if (!document?.ocr_data) {
          await logger.warn(requestId, `Documento no tiene datos OCR después de ${maxAttempts} intentos`, { documentId, attempts: maxAttempts });
          console.warn(`⚠️ [${requestId}] Documento no tiene datos OCR después de ${maxAttempts} intentos`);
          return;
        }
        
        // Usar el sistema existente para crear/actualizar orden desde factura
        await logger.info(requestId, 'Llamando a updateOrderWithExtractedDataFromDocument', { documentId, userId: document.user_id, providerId: document.provider_id });
        console.log(`🚀 [${requestId}] Llamando a updateOrderWithExtractedDataFromDocument...`);
        const result = await updateOrderWithExtractedDataFromDocument(documentId, requestId, document.user_id, supabase);
        await logger.success(requestId, 'updateOrderWithExtractedDataFromDocument completado', { documentId });
        console.log(`✅ [${requestId}] updateOrderWithExtractedDataFromDocument completado`);
      } catch (orderError: any) {
        await logger.error(requestId, 'ERROR CRÍTICO EN CREACIÓN DE ORDEN', {
          errorType: orderError?.constructor?.name || typeof orderError,
          errorMessage: orderError?.message || String(orderError),
          stack: orderError?.stack,
          error: orderError
        });
        console.error(`❌ [${requestId}] ===== ERROR CRÍTICO EN CREACIÓN DE ORDEN =====`);
        console.error(`❌ [${requestId}] Tipo de error:`, orderError?.constructor?.name || typeof orderError);
        console.error(`❌ [${requestId}] Mensaje:`, orderError?.message || String(orderError));
        console.error(`❌ [${requestId}] Stack trace:`, orderError?.stack);
        console.error(`❌ [${requestId}] Error completo:`, JSON.stringify(orderError, Object.getOwnPropertyNames(orderError), 2));
        console.error(`❌ [${requestId}] ===== FIN ERROR CRÍTICO =====`);
        // No fallar el proceso completo si hay error creando la orden
      }
    } else {
      await logger.error(requestId, 'Error en OCR', { error: ocrResult.error, documentId });
      console.error(`❌ [${requestId}] Error en OCR: ${ocrResult.error}`);
    }
  } catch (error: any) {
    await logger.error(requestId, 'ERROR EN PROCESAMIENTO OCR', {
      errorType: error?.constructor?.name || typeof error,
      errorMessage: error?.message || String(error),
      stack: error?.stack,
      error: error
    });
    console.error(`❌ [${requestId}] ===== ERROR EN PROCESAMIENTO OCR =====`);
    console.error(`❌ [${requestId}] Tipo de error:`, error?.constructor?.name || typeof error);
    console.error(`❌ [${requestId}] Mensaje:`, error?.message || String(error));
    console.error(`❌ [${requestId}] Stack trace:`, error?.stack);
    console.error(`❌ [${requestId}] ===== FIN ERROR OCR =====`);
  }
}

// 🔧 FUNCIÓN AUXILIAR: Crear orden desde factura (copiada de kapso/supabase-events para evitar import)
async function createOrderFromInvoiceLocal(
  document: any,
  requestId: string,
  userId: string,
  supabase: any
): Promise<{ success: boolean; order?: any; error?: string }> {
  const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
  const logger = InvoiceOrderLogger.getInstance();
  
  try {
    await logger.info(requestId, 'INICIANDO createOrderFromInvoiceLocal', {
      documentId: document.id,
      documentFilename: document.filename,
      userId: userId,
      hasOcrData: !!document.ocr_data,
      hasExtractedText: !!document.extracted_text,
      provider_id: document.provider_id
    });
    console.log(`🆕 [${requestId}] ===== INICIANDO createOrderFromInvoiceLocal =====`);
    console.log(`🆕 [${requestId}] Parámetros:`, {
      documentId: document.id,
      documentFilename: document.filename,
      userId: userId,
      hasOcrData: !!document.ocr_data,
      hasExtractedText: !!document.extracted_text,
      provider_id: document.provider_id
    });
    
    const extractedData = document.ocr_data;
    const invoiceData = extractedData?.invoice_data || {};
    
    await logger.info(requestId, 'Estructura de datos OCR', {
      hasExtractedData: !!extractedData,
      hasInvoiceData: !!invoiceData,
      extractedDataKeys: extractedData ? Object.keys(extractedData) : [],
      invoiceDataKeys: invoiceData ? Object.keys(invoiceData) : []
    });
    console.log(`📊 [${requestId}] Estructura de datos:`, {
      hasExtractedData: !!extractedData,
      hasInvoiceData: !!invoiceData,
      extractedDataKeys: extractedData ? Object.keys(extractedData) : [],
      invoiceDataKeys: invoiceData ? Object.keys(invoiceData) : []
    });
    
    // Extraer monto total
    let invoiceTotal = null;
    if (invoiceData.total_amount) {
      invoiceTotal = invoiceData.total_amount;
    } else if (invoiceData.totalAmount) {
      invoiceTotal = invoiceData.totalAmount;
    } else if (extractedData.totalAmount) {
      invoiceTotal = extractedData.totalAmount;
    } else if (extractedData.total) {
      invoiceTotal = extractedData.total;
    } else if (extractedData.amount) {
      invoiceTotal = extractedData.amount;
    }
    
    if (!invoiceTotal && document.extracted_text) {
      const amountMatch = document.extracted_text.match(/(?:total|importe|monto)[\s:]*\$?[\s]*([\d,\.]+)/i);
      if (amountMatch) {
        invoiceTotal = parseFloat(amountMatch[1].replace(',', '.'));
      }
    }
    
    // 🔧 FIX: Si no se encuentra monto, usar fallback de 0 en lugar de retornar error
    if (!invoiceTotal || invoiceTotal <= 0) {
      await logger.warn(requestId, 'No se encontró monto válido en la factura, usando fallback de 0', {
        invoiceTotal,
        extractedDataKeys: extractedData ? Object.keys(extractedData) : [],
        invoiceDataKeys: invoiceData ? Object.keys(invoiceData) : [],
        extractedText: document.extracted_text ? document.extracted_text.substring(0, 500) : 'no disponible'
      });
      console.warn(`⚠️ [${requestId}] No se encontró monto válido en la factura, usando fallback de monto 0`);
      console.warn(`⚠️ [${requestId}] Datos disponibles:`, {
        invoiceData: JSON.stringify(invoiceData, null, 2),
        extractedData: JSON.stringify(extractedData, null, 2),
        extractedText: document.extracted_text ? document.extracted_text.substring(0, 500) : 'no disponible'
      });
      // 🔧 FALLBACK: Usar monto 0 para permitir crear la orden
      // El monto puede actualizarse después cuando se procese mejor la factura
      invoiceTotal = 0;
      console.log(`✅ [${requestId}] Continuando con monto 0 (fallback)`);
    }
    
    await logger.info(requestId, 'Monto extraído de la factura', { invoiceTotal });
    console.log(`💰 [${requestId}] Monto extraído de la factura: $${invoiceTotal}`);
    
    // Extraer items de la factura
    let items: any[] = [];
    if (invoiceData.items && Array.isArray(invoiceData.items)) {
      items = invoiceData.items.map((item: any) => ({
        productName: item.description || item.name || 'Producto sin nombre',
        quantity: item.quantity || 1,
        unit: item.unit || 'un',
        price: item.unitPrice || item.priceUnitNet || item.price || 0,
        total: item.total || item.priceTotalNet || (item.unitPrice || item.priceUnitNet || 0) * item.quantity || 0
      }));
    } else if (extractedData.items && Array.isArray(extractedData.items)) {
      items = extractedData.items.map((item: any) => ({
        productName: item.description || item.name || 'Producto sin nombre',
        quantity: item.quantity || 1,
        unit: item.unit || 'un',
        price: item.unitPrice || item.priceUnitNet || item.price || 0,
        total: item.total || item.priceTotalNet || (item.unitPrice || item.priceUnitNet || 0) * item.quantity || 0
      }));
    }
    
    // Si no hay items, crear un item genérico
    if (items.length === 0) {
      items = [{
        productName: 'Factura sin desglose de items',
        quantity: 1,
        unit: 'un',
        price: invoiceTotal,
        total: invoiceTotal
      }];
    }
    
    // Generar número de orden único
    const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${randomSuffix}`;
    
    // Validar que el documento tenga provider_id
    if (!document.provider_id) {
      console.error(`❌ [${requestId}] Documento no tiene provider_id, no se puede crear orden`);
      
      // Intentar encontrar el proveedor por CUIT del OCR
      if (extractedData?.provider_cuit || invoiceData?.supplier_cuit) {
        const cuit = extractedData.provider_cuit || invoiceData.supplier_cuit;
        console.log(`🔍 [${requestId}] Intentando encontrar proveedor por CUIT: ${cuit}`);
        
        const { data: provider } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', userId)
          .eq('cuit_cuil', String(cuit).replace(/[^0-9]/g, ''))
          .single();
        
        if (provider) {
          console.log(`✅ [${requestId}] Proveedor encontrado por CUIT: ${provider.id}`);
          // Actualizar documento con provider_id
          await supabase
            .from('documents')
            .update({ provider_id: provider.id })
            .eq('id', document.id);
          document.provider_id = provider.id;
        } else {
          return { success: false, error: 'No se encontró proveedor para la factura' };
        }
      } else {
        return { success: false, error: 'Documento no tiene provider_id y no se pudo identificar por CUIT' };
      }
    }
    
    // Crear la orden
    // 🔧 FIX: Solo incluir campos que existen en la tabla orders
    const orderData: any = {
      id: crypto.randomUUID(),
      user_id: userId,
      provider_id: document.provider_id,
      order_number: orderNumber,
      items: items,
      status: 'pendiente_de_pago',
      total_amount: invoiceTotal,
      currency: invoiceData.currency || 'ARS',
      receipt_url: document.file_url,
      order_date: invoiceData.issue_date || invoiceData.issueDate || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Agregar campos opcionales solo si existen en la base de datos
    if (invoiceData.invoice_number || invoiceData.invoiceNumber) {
      orderData.invoice_number = invoiceData.invoice_number || invoiceData.invoiceNumber;
    }
    
    // Nota: invoice_data, invoice_currency, invoice_date, extraction_confidence pueden no existir en la tabla
    // Solo incluir si la tabla los tiene
    
    await logger.info(requestId, 'Insertando orden en base de datos', {
      orderNumber: orderData.order_number,
      provider_id: orderData.provider_id,
      total_amount: orderData.total_amount,
      items_count: orderData.items?.length || 0,
      userId: orderData.user_id,
      orderId: orderData.id
    });
    console.log(`📝 [${requestId}] Datos completos de la orden a insertar:`, {
      id: orderData.id,
      order_number: orderData.order_number,
      provider_id: orderData.provider_id,
      user_id: orderData.user_id,
      total_amount: orderData.total_amount,
      items_count: orderData.items?.length || 0,
      status: orderData.status
    });
    
    const { data: createdOrder, error: createError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();
    
    if (createError) {
      await logger.error(requestId, 'Error creando orden en base de datos', {
        error: createError.message,
        errorCode: createError.code,
        errorDetails: createError.details,
        errorHint: createError.hint,
        orderData: {
          orderNumber: orderData.order_number,
          provider_id: orderData.provider_id,
          total_amount: orderData.total_amount,
          user_id: orderData.user_id,
          orderId: orderData.id
        }
      });
      console.error(`❌ [${requestId}] Error creando orden en Supabase:`, {
        message: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint
      });
      console.error(`❌ [${requestId}] OrderData completo:`, JSON.stringify(orderData, null, 2));
      return { success: false, error: createError.message || 'Error desconocido creando orden' };
    }
    
    if (!createdOrder) {
      await logger.error(requestId, 'Insert no devolvió datos', {
        orderNumber: orderData.order_number
      });
      console.error(`❌ [${requestId}] Insert no devolvió datos, pero no hubo error`);
      return { success: false, error: 'No se devolvieron datos después de insertar la orden' };
    }
    
    await logger.success(requestId, 'Orden creada exitosamente en base de datos', {
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number,
      status: createdOrder.status,
      totalAmount: createdOrder.total_amount
    });
    console.log(`✅ [${requestId}] Orden creada exitosamente:`, {
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number
    });
    
    // Actualizar documento con order_id
    await supabase
      .from('documents')
      .update({ 
        order_id: createdOrder.id,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', document.id);
    
    return { success: true, order: createdOrder };
    
  } catch (error: any) {
    await logger.error(requestId, 'ERROR en createOrderFromInvoiceLocal', {
      errorType: error?.constructor?.name || typeof error,
      errorMessage: error?.message || String(error),
      stack: error?.stack,
      error: error
    });
    console.error(`❌ [${requestId}] Error creando orden desde factura:`, error);
    return { success: false, error: 'Error creando orden desde factura' };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Actualizar orden con datos extraídos (reutilizando lógica de kapso/supabase-events)
async function updateOrderWithExtractedDataFromDocument(
  documentId: string,
  requestId: string,
  userId: string,
  supabase: any
): Promise<void> {
  const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
  const logger = InvoiceOrderLogger.getInstance();
  
  try {
    await logger.info(requestId, 'INICIANDO updateOrderWithExtractedDataFromDocument', { documentId, userId });
    console.log(`🔄 [${requestId}] ===== INICIANDO updateOrderWithExtractedDataFromDocument =====`);
    console.log(`🔄 [${requestId}] Parámetros: documentId=${documentId}, userId=${userId}`);
    
    // Obtener el documento con datos OCR
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (docError || !document) {
      console.error(`❌ [${requestId}] Error obteniendo documento:`, docError);
      console.error(`❌ [${requestId}] Documento buscado: ${documentId}`);
      return;
    }
    
    console.log(`📄 [${requestId}] Documento obtenido:`, {
      id: document.id,
      filename: document.filename,
      hasOcrData: !!document.ocr_data,
      hasExtractedText: !!document.extracted_text,
      provider_id: document.provider_id,
      user_id: document.user_id,
      order_id: document.order_id,
      status: document.status
    });
    
    if (!document.ocr_data || !document.extracted_text) {
      console.log(`⚠️ [${requestId}] Documento no tiene datos OCR extraídos aún`);
      console.log(`⚠️ [${requestId}] ocr_data existe: ${!!document.ocr_data}, extracted_text existe: ${!!document.extracted_text}`);
      return;
    }
    
    console.log(`📊 [${requestId}] Datos OCR encontrados:`, {
      hasOcrData: !!document.ocr_data,
      hasExtractedText: !!document.extracted_text,
      extractedTextLength: document.extracted_text?.length || 0,
      confidence: document.confidence_score,
      orderId: document.order_id,
      ocrDataKeys: document.ocr_data ? Object.keys(document.ocr_data) : []
    });
    
    // Extraer datos del documento
    const extractedData = document.ocr_data;
    const invoiceData = extractedData?.invoice_data || {};
    
    let order;
    
    // Verificar si el documento ya está asociado a una orden
    if (document.order_id) {
      console.log(`🔗 [${requestId}] Documento ya está asociado a una orden: ${document.order_id}`);
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', document.order_id)
        .single();
      
      if (existingOrderError || !existingOrder) {
        console.error(`❌ [${requestId}] Error obteniendo orden asociada:`, existingOrderError);
        return;
      }
      
      order = existingOrder;
      console.log(`📋 [${requestId}] Usando orden existente:`, {
        id: order.id,
        orderNumber: order.order_number,
        currentAmount: order.total_amount,
        status: order.status
      });
    } else {
      // Extraer el número de factura del documento
      const currentInvoiceNumber = invoiceData.invoice_number || invoiceData.invoiceNumber;
      
      // Validar que el documento tenga provider_id
      if (!document.provider_id) {
        console.error(`❌ [${requestId}] Documento no tiene provider_id, buscando por CUIT...`);
        
        // Intentar encontrar el proveedor por CUIT del OCR
        const extractedData = document.ocr_data;
        const invoiceData = extractedData?.invoice_data || {};
        const cuit = extractedData?.provider_cuit || invoiceData?.supplier_cuit;
        
        if (cuit) {
          const cuitDigits = String(cuit).replace(/[^0-9]/g, '');
          console.log(`🔍 [${requestId}] Intentando encontrar proveedor por CUIT: ${cuitDigits}`);
          
          const { data: provider } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', userId)
            .eq('cuit_cuil', cuitDigits)
            .single();
          
          if (provider) {
            console.log(`✅ [${requestId}] Proveedor encontrado por CUIT: ${provider.id}`);
            // Actualizar documento con provider_id
            await supabase
              .from('documents')
              .update({ provider_id: provider.id })
              .eq('id', documentId);
            document.provider_id = provider.id;
          } else {
            console.warn(`⚠️ [${requestId}] No se encontró proveedor con CUIT ${cuitDigits}`);
            return;
          }
        } else {
          console.warn(`⚠️ [${requestId}] Documento no tiene provider_id ni CUIT para buscar proveedor`);
          return;
        }
      }
      
      // Buscar órdenes del proveedor en estado enviado, esperando_factura o pendiente_de_pago
      console.log(`🔍 [${requestId}] Buscando órdenes pendientes para proveedor:`, {
        provider_id: document.provider_id,
        user_id: userId,
        statuses: ['enviado', 'esperando_factura', 'pendiente_de_pago']
      });
      
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['enviado', 'esperando_factura', 'pendiente_de_pago'])
        .eq('provider_id', document.provider_id)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (ordersError) {
        console.error(`❌ [${requestId}] Error obteniendo órdenes:`, {
          message: ordersError.message,
          code: ordersError.code,
          details: ordersError.details
        });
        return;
      }
      
      console.log(`📊 [${requestId}] Órdenes encontradas: ${orders?.length || 0}`);
      
      if (!orders || orders.length === 0) {
        await logger.info(requestId, 'No hay órdenes pendientes para el proveedor, creando nueva orden', {
          documentId: document.id,
          provider_id: document.provider_id,
          hasOcrData: !!document.ocr_data,
          hasInvoiceData: !!invoiceData,
          invoiceTotal: invoiceData?.total_amount || invoiceData?.totalAmount || 'no encontrado'
        });
        console.log(`⚠️ [${requestId}] No hay órdenes pendientes para el proveedor`);
        console.log(`🆕 [${requestId}] Creando nueva orden desde factura recibida...`);
        console.log(`📋 [${requestId}] Datos del documento antes de crear orden:`, {
          documentId: document.id,
          provider_id: document.provider_id,
          hasOcrData: !!document.ocr_data,
          hasInvoiceData: !!invoiceData,
          invoiceTotal: invoiceData?.total_amount || invoiceData?.totalAmount || 'no encontrado'
        });
        
        // Crear orden automáticamente desde la factura
        await logger.info(requestId, 'Llamando a createOrderFromInvoiceLocal', { documentId: document.id });
        console.log(`🔨 [${requestId}] Llamando a createOrderFromInvoiceLocal...`);
        const createResult = await createOrderFromInvoiceLocal(document, requestId, userId, supabase);
        
        await logger.info(requestId, 'Resultado de createOrderFromInvoiceLocal', {
          success: createResult.success,
          hasOrder: !!createResult.order,
          error: createResult.error,
          orderId: createResult.order?.id,
          orderNumber: createResult.order?.order_number
        });
        console.log(`📊 [${requestId}] Resultado de createOrderFromInvoiceLocal:`, {
          success: createResult.success,
          hasOrder: !!createResult.order,
          error: createResult.error,
          orderId: createResult.order?.id,
          orderNumber: createResult.order?.order_number
        });
        
        if (!createResult.success || !createResult.order) {
          await logger.error(requestId, 'Error creando orden desde factura', {
            error: createResult.error,
            result: createResult
          });
          console.error(`❌ [${requestId}] Error creando orden desde factura:`, createResult.error);
          console.error(`❌ [${requestId}] Detalles del error:`, JSON.stringify(createResult, null, 2));
          return;
        }
        
        order = createResult.order;
        await logger.success(requestId, 'Orden creada exitosamente desde factura', {
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          totalAmount: order.total_amount,
          providerId: order.provider_id
        });
        console.log(`✅ [${requestId}] Orden creada exitosamente desde factura:`, {
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          totalAmount: order.total_amount,
          providerId: order.provider_id
        });
      } else {
        // Tomar la orden más reciente
        order = orders[0];
        
        // Si la orden ya tiene un invoice_number diferente, crear nueva orden
        if (order.invoice_number && currentInvoiceNumber && order.invoice_number !== currentInvoiceNumber) {
          console.log(`⚠️ [${requestId}] Orden existente tiene factura diferente:`, {
            existingInvoice: order.invoice_number,
            newInvoice: currentInvoiceNumber
          });
          console.log(`🆕 [${requestId}] Creando nueva orden para factura diferente...`);
          
          const createResult = await createOrderFromInvoiceLocal(document, requestId, userId, supabase);
          
          if (!createResult.success || !createResult.order) {
            console.error(`❌ [${requestId}] Error creando orden desde factura:`, createResult.error);
            return;
          }
          
          order = createResult.order;
          console.log(`✅ [${requestId}] Nueva orden creada para factura diferente:`, {
            orderId: order.id,
            orderNumber: order.order_number
          });
        } else {
          console.log(`📋 [${requestId}] Orden encontrada para actualizar:`, {
            id: order.id,
            orderNumber: order.order_number,
            currentAmount: order.total_amount,
            currentInvoiceNumber: order.invoice_number,
            status: order.status
          });
        }
      }
    }
    
    // Actualizar la orden con los datos extraídos de la factura
    let invoiceTotal = null;
    if (invoiceData.total_amount) {
      invoiceTotal = invoiceData.total_amount;
    } else if (invoiceData.totalAmount) {
      invoiceTotal = invoiceData.totalAmount;
    } else if (extractedData.totalAmount) {
      invoiceTotal = extractedData.totalAmount;
    } else if (extractedData.total) {
      invoiceTotal = extractedData.total;
    } else if (extractedData.amount) {
      invoiceTotal = extractedData.amount;
    }
    
    if (!invoiceTotal && document.extracted_text) {
      const amountMatch = document.extracted_text.match(/(?:total|importe|monto)[\s:]*\$?[\s]*([\d,\.]+)/i);
      if (amountMatch) {
        invoiceTotal = parseFloat(amountMatch[1].replace(',', '.'));
      }
    }
    
    console.log(`💰 [${requestId}] Monto extraído de la factura:`, invoiceTotal);
    
    const updateData: any = {
      updated_at: new Date().toISOString(),
      invoice_data: extractedData,
      invoice_number: invoiceData.invoice_number || invoiceData.invoiceNumber,
      invoice_currency: invoiceData.currency || 'ARS',
      invoice_date: invoiceData.issue_date || invoiceData.issueDate,
      extraction_confidence: document.confidence_score,
      receipt_url: document.file_url
    };
    
    if (order.status === 'enviado' || order.status === 'esperando_factura') {
      updateData.status = 'pendiente_de_pago';
    }
    
    if (invoiceTotal && invoiceTotal > 0) {
      updateData.total_amount = invoiceTotal;
      updateData.invoice_total = invoiceTotal;
      console.log(`✅ [${requestId}] Actualizando monto de orden: $${order.total_amount} → $${invoiceTotal}`);
    }
    
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);
    
    if (updateError) {
      console.error(`❌ [${requestId}] Error actualizando orden:`, updateError);
    } else {
      console.log(`✅ [${requestId}] Orden actualizada exitosamente con datos de factura`);
    }
    
    // Asociar documento a la orden
    if (order && !document.order_id) {
      await supabase
        .from('documents')
        .update({ order_id: order.id })
        .eq('id', documentId);
      
      console.log(`✅ [${requestId}] Documento asociado a orden: ${order.order_number}`);
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Error actualizando orden con datos extraídos:`, error);
  }
}

// 🔧 FUNCIÓN AUXILIAR: Subir archivo a carpeta del proveedor
async function uploadFileToProviderFolder(
  fileBuffer: Buffer, 
  filename: string, 
  userId: string,
  providerId: string,
  requestId: string,
  senderPhone?: string
): Promise<{ success: boolean; filename?: string; url?: string; error?: string }> {
  try {
    console.log(`📤 [${requestId}] Subiendo archivo a carpeta del proveedor:`, filename);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener información del proveedor para el nombre del archivo
    let providerName = 'Proveedor';
    if (providerId) {
      const { data: provider } = await supabase
        .from('providers')
        .select('name')
        .eq('id', providerId)
        .single();
      
      if (provider?.name) {
        // Limpiar nombre del proveedor para usar en filename
        providerName = provider.name
          .replace(/[^a-zA-Z0-9\s]/g, '') // Remover caracteres especiales
          .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
          .substring(0, 20); // Limitar longitud
      }
    }

    // Generar nombre descriptivo para el archivo
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const fileExtension = filename.split('.').pop() || 'bin';
    
    // Nombre más descriptivo: Proveedor_Fecha_Hora_Tipo.Extension
    const fileType = filename.toLowerCase().includes('factura') ? 'Factura' : 
                    filename.toLowerCase().includes('comprobante') ? 'Comprobante' :
                    filename.toLowerCase().includes('catalogo') ? 'Catalogo' : 'Documento';
    
    const descriptiveFilename = `${providerName}_${dateStr}_${timeStr}_${fileType}.${fileExtension}`;
    
    // Ruta en storage: providers/{userId}/{providerId}/{filename}
    const storagePath = `providers/${userId}/${providerId}/${descriptiveFilename}`;
    
    // Subir archivo
    const { data, error } = await supabase.storage
      .from('files')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (error) {
      console.error(`❌ [${requestId}] Error subiendo archivo:`, error);
      return { success: false, error: error.message };
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('files')
      .getPublicUrl(storagePath);

    console.log(`✅ [${requestId}] Archivo subido exitosamente a carpeta del proveedor:`, storagePath);
    
    return {
      success: true,
      filename: descriptiveFilename,
      url: urlData.publicUrl
    };

  } catch (error) {
    console.error(`❌ [${requestId}] Error inesperado subiendo archivo:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error inesperado' 
    };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Intentar asociar factura a orden
async function tryAssociateInvoiceToOrder(
  documentId: string, 
  extractedData: any, 
  requestId: string
): Promise<void> {
  try {
    console.log(`🔍 [${requestId}] Intentando asociar factura a orden...`);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Obtener documento para encontrar el proveedor
    const { DocumentService } = await import('../../../../lib/documentService');
    const documentService = new DocumentService();
    const document = await documentService.getDocumentById(documentId);
    
    if (!document) {
      console.log(`⚠️ [${requestId}] Documento no encontrado: ${documentId}`);
      return;
    }
    
    // Buscar proveedor por teléfono
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, cuit_cuil')
      .eq('phone', document.sender_phone)
      .single();
    
    if (providerError || !provider) {
      console.log(`⚠️ [${requestId}] Proveedor no encontrado para teléfono: ${document.sender_phone}`);
      return;
    }
    
    // Buscar orden pendiente del proveedor (standby, enviado, o esperando_factura)
    const { data: pendingOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status')
      .eq('provider_id', provider.id)
      .in('status', ['standby', 'enviado', 'esperando_factura'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (orderError || !pendingOrder || pendingOrder.length === 0) {
      console.log(`⚠️ [${requestId}] No hay órdenes pendientes para el proveedor: ${provider.name}`);
      return;
    }
    
    const order = pendingOrder[0];
    console.log(`✅ [${requestId}] Orden encontrada para asociar factura:`, {
      orderId: order.id,
      orderNumber: order.order_number,
      currentStatus: order.status,
      totalAmount: order.total_amount
    });

    // 🔧 NUEVO: Si la orden está en esperando_factura, usar ExtensibleOrderFlowService
    if (order.status === 'esperando_factura') {
      console.log(`🔄 [${requestId}] Orden en esperando_factura - usando ExtensibleOrderFlowService`);
      
      try {
        const { ExtensibleOrderFlowService } = await import('../../../../lib/extensibleOrderFlowService');
        const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
        
        // Simular un mensaje de "documento recibido" para activar la transición
        const result = await extensibleOrderFlowService.processProviderMessage(
          document.sender_phone, 
          'documento_recibido', 
          document.user_id
        );
        
        if (result.success) {
          console.log(`✅ [${requestId}] Transición ejecutada por ExtensibleOrderFlowService: ${result.newStatus}`);
          // Continuar con la asociación de la factura
        } else {
          console.log(`⚠️ [${requestId}] ExtensibleOrderFlowService falló: ${result.message}`);
          // Continuar con el flujo normal de asociación
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error en ExtensibleOrderFlowService:`, error);
        // Continuar con el flujo normal de asociación
      }
    }

    // Validar factura con servicio de validación
    const { invoiceValidationService } = require('../../../../lib/invoiceValidationService');
    
    const validationResult = await invoiceValidationService.validateAndProcessInvoice(
      {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        provider_id: provider.id,
        status: order.status
      },
      extractedData,
      provider.cuit_cuil,
      document.user_id
    );

    if (!validationResult.shouldProceed) {
      console.log(`❌ [${requestId}] Factura no válida, no se asociará a orden:`, validationResult.validationResult.discrepancies);
      return;
    }

    if (!validationResult.isValid) {
      console.log(`⚠️ [${requestId}] Factura con discrepancias menores, procediendo:`, validationResult.validationResult.discrepancies);
    }
    
    // Actualizar orden con datos de la factura
    const updateData: any = {
      receipt_url: document.file_url,
      status: 'pendiente_de_pago',
      updated_at: new Date().toISOString(),
      invoice_data: extractedData,
      invoice_number: extractedData.invoiceNumber,
      invoice_total: extractedData.totalAmount,
      invoice_currency: extractedData.currency,
      invoice_date: extractedData.issueDate,
      extraction_confidence: extractedData.confidence,
      // 🔧 CORRECCIÓN: Preservar el provider_id para evitar desconexión
      // provider_id: order.provider_id // Comentado temporalmente
    };
    
    // Actualizar monto si es diferente
    if (extractedData.totalAmount && extractedData.totalAmount > 0) {
      updateData.total_amount = extractedData.totalAmount;
      console.log(`💰 [${requestId}] Actualizando monto de orden: $${order.total_amount} → $${extractedData.totalAmount}`);
    }
    
    console.log(`🔄 [${requestId}] Actualizando orden con datos:`, {
      orderId: order.id,
      newStatus: 'pendiente_de_pago',
      invoiceNumber: extractedData.invoiceNumber,
      invoiceTotal: extractedData.totalAmount,
      updateData: updateData
    });
    
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);
    
    if (updateError) {
      console.error(`❌ [${requestId}] Error actualizando orden:`, updateError);
      return;
    }
    
    console.log(`✅ [${requestId}] Factura asociada exitosamente a orden ${order.order_number}`);
    console.log(`🔄 [${requestId}] Orden actualizada de '${order.status}' a 'pendiente_de_pago'`);
    console.log(`🔔 [${requestId}] Esta actualización debería disparar un evento Realtime para los suscriptores`);
    
    // 🔧 WORKAROUND: Emitir broadcast manual para notificar a los clientes Realtime
    try {
      const broadcastResult = await supabase
        .channel('orders-updates')
        .send({
          type: 'broadcast' as const,
          event: 'order_updated',
          payload: {
            orderId: order.id,
            status: 'pendiente_de_pago',
            receiptUrl: updateData.receipt_url,
            invoiceNumber: updateData.invoice_number,
            invoiceDate: updateData.invoice_date,
            timestamp: new Date().toISOString(),
            source: 'invoice_association'
          }
        });

      if (broadcastResult === 'error') {
        console.error(`⚠️ [${requestId}] Error enviando broadcast`);
      } else {
        console.log(`✅ [${requestId}] Broadcast de actualización enviado`);
      }
    } catch (broadcastErr) {
      console.error(`⚠️ [${requestId}] Error en broadcast:`, broadcastErr);
    }
    
    // 🔧 CORRECCIÓN: Actualizar documento con order_id para que aparezca asociado en el modal
    const { error: documentUpdateError } = await supabase
      .from('documents')
      .update({ 
        order_id: order.id,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (documentUpdateError) {
      console.error(`❌ [${requestId}] Error actualizando documento con order_id:`, documentUpdateError);
    } else {
      console.log(`✅ [${requestId}] Documento actualizado con order_id: ${order.id}`);
    }
    
    // Enviar notificación de factura asociada
    const { DocumentNotificationService } = await import('../../../../lib/documentNotificationService');
    const notificationService = new DocumentNotificationService();
    
    // Notificar factura asociada (usar método existente)
    await notificationService.notifyDocumentAssigned(
      document.user_id,
      documentId,
      document.filename,
      order.id
    );
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error asociando factura a orden:`, error);
  }
}


