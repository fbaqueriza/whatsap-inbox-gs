import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';
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
  
  try {
    console.log(`🚀 [${requestId}] WEBHOOK INICIADO:`, new Date().toISOString());
    
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log(`📥 [${requestId}] Webhook recibido:`, JSON.stringify(body, null, 2));
    }

    // Verificar que es un mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      console.log(`✅ [${requestId}] Es un mensaje de WhatsApp Business Account`);
      
      const entry = body.entry?.[0];
      if (!entry?.changes?.[0]?.value) {
        console.log(`⚠️ [${requestId}] No se encontraron cambios en el webhook`);
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
        console.log(`📱 [${requestId}] Procesando ${value.messages.length} mensajes`);
        
        for (const message of value.messages) {
          try {
            const result = await processWhatsAppMessage(message, requestId);
            if (result.success) {
              processedCount++;
            } else {
              errorCount++;
              console.error(`❌ [${requestId}] Error procesando mensaje:`, result.error);
            }
          } catch (error) {
            errorCount++;
            console.error(`❌ [${requestId}] Error procesando mensaje individual:`, error);
          }
        }
      }

      // 🔧 NUEVA FUNCIONALIDAD: Procesar actualizaciones de template
      if (value.event === 'APPROVED' && value.message_template_name) {
        console.log(`✅ [${requestId}] Template ${value.message_template_name} aprobado`);
        processedCount++;
      }

      if (processedCount === 0 && errorCount === 0) {
        console.log(`⚠️ [${requestId}] No se encontraron mensajes ni statuses en el webhook`);
      } else {
        console.log(`✅ [${requestId}] Procesados ${processedCount} elementos (${errorCount} errores)`);
      }
    } else {
      console.log(`❌ [${requestId}] No es un mensaje de WhatsApp Business Account`);
    }

    const duration = Date.now() - startTime;
    console.log(`🏁 [${requestId}] WEBHOOK COMPLETADO en ${duration}ms`);
    
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
    
    console.log(`📊 [${requestId}] Procesando status de WhatsApp:`, {
      id,
      status: statusType,
      recipient_id,
      timestamp,
      hasErrors: !!errors
    });

    // 🔧 NUEVA FUNCIONALIDAD: Manejar errores de engagement
    if (statusType === 'failed' && errors && Array.isArray(errors)) {
      for (const error of errors) {
        if (error.code === 131047 || error.code === 131049) {
          console.log(`⚠️ [${requestId}] Error de engagement detectado:`, {
            code: error.code,
            title: error.title,
            recipient: recipient_id
          });

          // 🔧 ACTIVAR ESTRATEGIA DE ACTIVACIÓN MANUAL
          await handleEngagementError(recipient_id, error, requestId);
        }
      }
    }

    // 🔧 NUEVA FUNCIONALIDAD: Actualizar estado de mensaje en base de datos
    await updateMessageStatus(id, statusType, recipient_id, timestamp, errors, requestId);
    
    const duration = Date.now() - statusStartTime;
    console.log(`✅ [${requestId}] Status procesado en ${duration}ms`);
    
    return { success: true, duration: duration };
    
  } catch (error) {
    const duration = Date.now() - statusStartTime;
    console.error(`❌ [${requestId}] Error procesando status de WhatsApp:`, error);
    console.error(`💥 [${requestId}] Status falló en ${duration}ms`);
    
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
      console.error(`❌ [${requestId}] Error buscando pedidos pendientes:`, pendingError);
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
        console.error(`❌ [${requestId}] Error actualizando pedido pendiente:`, updateError);
      } else {
        console.log(`✅ [${requestId}] Pedido ${pendingOrder.order_id} marcado como "requiere activación manual"`);
      }
    } else {
      console.log(`ℹ️ [${requestId}] No se encontraron pedidos pendientes para ${recipientId}`);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error manejando error de engagement:`, error);
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
    
    console.log(`📱 [${requestId}] Procesando mensaje de WhatsApp:`, {
      from,
      text: text?.body,
      hasImage: !!image,
      hasDocument: !!document,
      timestamp
    });

    // Normalizar número de teléfono
    let normalizedFrom = from;
    if (from && !from.startsWith('+')) {
      normalizedFrom = `+${from}`;
    }

    // 🔧 NUEVA FUNCIONALIDAD: Procesar archivos multimedia (facturas)
    if (image || document) {
      console.log(`📎 [${requestId}] Archivo multimedia detectado, procesando como posible factura...`);
      
      try {
        const mediaResult = await processMediaAsInvoice(normalizedFrom, image || document, requestId);
        if (mediaResult.success) {
          console.log(`✅ [${requestId}] Factura procesada exitosamente:`, mediaResult.orderId);
          
          // 🔧 NO enviar confirmación - solo procesar silenciosamente
          
          const duration = Date.now() - messageStartTime;
          console.log(`✅ [${requestId}] Factura procesada en ${duration}ms`);
          return { success: true, duration: duration, type: 'invoice' };
        } else {
          console.log(`⚠️ [${requestId}] Archivo no procesado como factura:`, mediaResult.error);
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error procesando archivo multimedia:`, error);
      }
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

    // Procesar respuesta del proveedor (solo para texto)
    if (text?.body) {
      console.log(`🔄 [${requestId}] Iniciando processProviderResponse para:`, normalizedFrom);
      
      try {
        console.log(`🔧 [${requestId}] DEBUG - Antes de llamar a processProviderResponse`);
        const success = await OrderNotificationService.processProviderResponse(normalizedFrom, text.body);
        console.log(`🔧 [${requestId}] DEBUG - Después de processProviderResponse, resultado:`, success);
        
        if (success) {
          console.log(`✅ [${requestId}] Respuesta del proveedor procesada exitosamente`);
        } else {
          console.log(`ℹ️ [${requestId}] No se encontró pedido pendiente para este número:`, normalizedFrom);
        }
      } catch (error) {
        console.error(`❌ [${requestId}] ERROR en processProviderResponse:`, error);
        if (error instanceof Error) {
          console.error(`❌ [${requestId}] Stack trace:`, error.stack);
        }
      }
    } else if (!image && !document) {
      console.log(`⚠️ [${requestId}] Mensaje sin texto ni archivo recibido de:`, normalizedFrom);
    }
    
    const duration = Date.now() - messageStartTime;
    console.log(`✅ [${requestId}] Mensaje procesado en ${duration}ms`);
    
    return { success: true, duration: duration, type: 'text' };
    
  } catch (error) {
    const duration = Date.now() - messageStartTime;
    console.error(`❌ [${requestId}] Error procesando mensaje de WhatsApp:`, error);
    console.error(`💥 [${requestId}] Mensaje falló en ${duration}ms`);
    
    if (error instanceof Error) {
      console.error(`❌ [${requestId}] Stack trace:`, error.stack);
    }
    
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

// 🔧 NUEVA FUNCIÓN: Procesar archivos multimedia como facturas
async function processMediaAsInvoice(providerPhone: string, media: any, requestId: string) {
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
    
    // 🔧 MEJORA: Búsqueda más robusta de proveedores
    const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
    
    // Normalizar el número recibido
    const normalizedPhone = PhoneNumberService.normalizeUnified(providerPhone);
    console.log(`🔧 [${requestId}] Número normalizado:`, normalizedPhone);
    
    // Generar variantes de búsqueda
    const searchVariants = PhoneNumberService.searchVariants(providerPhone);
    console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
    
    // 🔧 MEJORA: Búsqueda más eficiente con OR lógico
    let provider = null;
    
    // Primero intentar con búsqueda exacta por cada variante
    for (const variant of searchVariants) {
      console.log(`🔍 [${requestId}] Buscando proveedor con variante:`, variant);
      
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id, name, phone')
        .eq('phone', variant)
        .single();
      
      if (!providerError && providerData) {
        provider = providerData;
        console.log(`✅ [${requestId}] Proveedor encontrado con búsqueda exacta:`, provider.name, `(${provider.phone})`);
        break;
      }
    }
    
    // 🔧 MEJORA: Si no se encuentra, intentar búsqueda más flexible
    if (!provider) {
      console.log(`⚠️ [${requestId}] No se encontró proveedor con búsqueda exacta, intentando búsqueda flexible...`);
      
      // Búsqueda por similitud de números (últimos 8-10 dígitos)
      const lastDigits = providerPhone.replace(/\D/g, '').slice(-8);
      if (lastDigits.length >= 8) {
        console.log(`🔍 [${requestId}] Buscando por últimos dígitos:`, lastDigits);
        
        const { data: providers, error: searchError } = await supabase
          .from('providers')
          .select('id, name, phone')
          .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`);
        
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
      console.log(`❌ [${requestId}] No se pudo encontrar proveedor. Información de debug:`);
      console.log(`📱 [${requestId}] Número recibido:`, providerPhone);
      console.log(`🔧 [${requestId}] Número normalizado:`, normalizedPhone);
      console.log(`🔍 [${requestId}] Variantes de búsqueda:`, searchVariants);
      
      // Intentar obtener todos los proveedores para debug
      const { data: allProviders, error: debugError } = await supabase
        .from('providers')
        .select('id, name, phone')
        .limit(5);
      
      if (!debugError && allProviders) {
        console.log(`🔍 [${requestId}] Primeros 5 proveedores en BD:`, allProviders.map(p => ({ name: p.name, phone: p.phone })));
      }
      
      return { success: false, error: 'Proveedor no encontrado' };
    }
    
    // Buscar orden pendiente más reciente del proveedor
    const { data: latestOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status')
      .eq('provider_id', provider.id)
      .is('receipt_url', null)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (orderError || !latestOrder || latestOrder.length === 0) {
      console.log(`⚠️ [${requestId}] No se encontraron órdenes pendientes para proveedor:`, provider.name);
      return { success: false, error: 'No se encontraron órdenes pendientes para este proveedor' };
    }
    
    const orderToUpdate = latestOrder[0];
    console.log(`📋 [${requestId}] Orden pendiente encontrada:`, orderToUpdate.order_number);
    
    // Descargar archivo desde WhatsApp y subirlo a Supabase Storage
    const { data: fileBuffer, error: downloadError } = await downloadMediaFromWhatsApp(mediaUrl, requestId);
    
    if (downloadError || !fileBuffer) {
      return { success: false, error: 'Error descargando archivo desde WhatsApp' };
    }
    
    // Generar nombre único para el archivo
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
    
    // Asociar factura a la orden
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        receipt_url: publicUrl,
        status: 'invoice_received',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderToUpdate.id);
    
    if (updateError) {
      console.error(`❌ [${requestId}] Error asociando factura a orden:`, updateError);
      return { success: false, error: 'Error asociando factura a orden' };
    }
    
    console.log(`✅ [${requestId}] Factura asociada exitosamente a orden ${orderToUpdate.order_number}`);
    
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
        
        // 🔧 MEJORA: Si es JSON, probablemente es un error de WhatsApp
        if (contentType.includes('application/json')) {
          console.warn(`⚠️ [${requestId}] WhatsApp devolvió JSON en lugar de archivo. Posible error de API.`);
          
          // Intentar leer el contenido JSON para debugging
          try {
            const jsonContent = await response.text();
            console.log(`🔍 [${requestId}] Contenido JSON recibido:`, jsonContent);
            
            // Si es un error de WhatsApp, retornar información útil
            if (jsonContent.includes('error') || jsonContent.includes('Error')) {
              return { 
                data: null, 
                error: `WhatsApp API error: ${jsonContent.substring(0, 200)}` 
              };
            }
          } catch (textError) {
            console.warn(`⚠️ [${requestId}] No se pudo leer contenido JSON:`, textError);
          }
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
    } else {
      console.log(`✅ [${requestId}] Encontrado usuario de la app ${userId} para proveedor ${contactId}`);
    }

    // Guardar mensaje con user_id del usuario de la app
    const messageSid = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert([{
        content: content,
        message_type: 'received',
        status: 'delivered',
        contact_id: contactId, // Número del proveedor
        user_id: userId, // ID del usuario de la app
        message_sid: messageSid,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        created_at: new Date().toISOString()
      }]);

    if (saveError) {
      console.error(`❌ [${requestId}] Error guardando mensaje:`, saveError);
      return { success: false, error: saveError.message };
    } else {
      console.log(`✅ [${requestId}] Mensaje guardado con user_id del usuario de la app: ${userId || 'null'}`);
      console.log(`📝 [${requestId}] Message SID: ${messageSid}`);
      return { success: true, userId: userId, messageSid: messageSid };
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Error en saveMessageWithUserId:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
