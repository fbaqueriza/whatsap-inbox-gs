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
    console.log(`📥 [${requestId}] Webhook recibido:`, JSON.stringify(body, null, 2));

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
    const { from, text, timestamp } = message;
    
    console.log(`📱 [${requestId}] Procesando mensaje de WhatsApp:`, {
      from,
      text: text?.body,
      timestamp
    });

    // Normalizar número de teléfono
    let normalizedFrom = from;
    if (from && !from.startsWith('+')) {
      normalizedFrom = `+${from}`;
    }

    // 🔧 NUEVA FUNCIONALIDAD: Guardar mensaje con user_id asignado
    const saveResult = await saveMessageWithUserId(normalizedFrom, text?.body, timestamp, requestId);
    
    if (saveResult.success) {
      console.log(`✅ [${requestId}] Mensaje guardado con user_id: ${saveResult.userId}`);
    } else {
      console.log(`❌ [${requestId}] Error guardando mensaje: ${saveResult.error}`);
      return { success: false, error: saveResult.error };
    }

    // Procesar respuesta del proveedor
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
    } else {
      console.log(`⚠️ [${requestId}] Mensaje sin texto recibido de:`, normalizedFrom);
    }
    
    const duration = Date.now() - messageStartTime;
    console.log(`✅ [${requestId}] Mensaje procesado en ${duration}ms`);
    
    return { success: true, duration: duration };
    
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

    // 🔧 CORRECCIÓN: Usar normalización unificada para búsquedas
    const searchVariants = PhoneNumberService.searchVariants(contactId);
    
    // 🔧 MEJORA: Log del número normalizado esperado para debugging
    const expectedNormalized = PhoneNumberService.normalizeUnified(contactId);
    console.log(`🔍 [${requestId}] Número normalizado esperado para búsqueda:`, expectedNormalized);
    
    let providersQuery = supabase
      .from('providers')
      .select('user_id, phone');
    
    // Construir query dinámico con todas las variantes usando OR dinámico
    if (searchVariants.length > 0) {
      // Construir query OR correctamente para Supabase
      const orConditions = searchVariants.map(variant => `phone.eq.${variant}`).join(',');
      providersQuery = providersQuery.or(orConditions);
    } else {
      // Búsqueda básica si no se puede normalizar
      providersQuery = providersQuery.or(`phone.eq.${contactId},phone.eq.${contactId.replace('+', '')}`);
    }
    
    const { data: providers, error: providersError } = await providersQuery;

    if (providersError) {
      console.error(`❌ [${requestId}] Error buscando proveedor:`, providersError);
      return { success: false, error: 'Error buscando proveedor' };
    }

    let userId = null;
    if (providers && providers.length > 0) {
      userId = providers[0].user_id; // Este es el user_id del usuario de la app
      console.log(`✅ [${requestId}] Encontrado usuario de la app ${userId} para proveedor ${contactId}`);
    } else {
      console.log(`⚠️ [${requestId}] No se encontró usuario de la app para proveedor ${contactId}`);
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
