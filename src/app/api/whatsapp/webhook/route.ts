import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

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
    // 🔧 LOG CRÍTICO: Siempre loguear para debugging
    console.log(`🚀 [${requestId}] WEBHOOK INICIADO:`, new Date().toISOString());
    
    const body = await request.json();
    console.log(`📥 [${requestId}] Webhook recibido:`, JSON.stringify(body, null, 2));

    // Verificar que es un mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      console.log(`✅ [${requestId}] Es un mensaje de WhatsApp Business Account`);
      
      const entry = body.entry?.[0];
      if (entry?.changes?.[0]?.value?.messages) {
        const messages = entry.changes[0].value.messages;
        console.log(`📱 [${requestId}] Procesando ${messages.length} mensajes`);
        
        let processedCount = 0;
        let errorCount = 0;
        
        for (const message of messages) {
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
        
        console.log(`✅ [${requestId}] Procesados ${processedCount}/${messages.length} mensajes (${errorCount} errores)`);
      } else {
        console.log(`⚠️ [${requestId}] No se encontraron mensajes en el webhook`);
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

async function processWhatsAppMessage(message: any, requestId: string) {
  const messageStartTime = Date.now();
  
  try {
    const { from, text, timestamp } = message;
    
    console.log(`📱 [${requestId}] Procesando mensaje de WhatsApp:`, {
      from,
      text: text?.body,
      timestamp
    });

    // 🔧 MEJORA: Normalizar número de teléfono
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
      
      const success = await OrderNotificationService.processProviderResponse(normalizedFrom, text.body);
      
      if (success) {
        console.log(`✅ [${requestId}] Respuesta del proveedor procesada exitosamente`);
      } else {
        console.log(`ℹ️ [${requestId}] No se encontró pedido pendiente para este número:`, normalizedFrom);
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

    // 🔧 CORRECCIÓN: Buscar usuario de la app que tenga este número como proveedor
    // Buscar tanto con + como sin + para mayor compatibilidad
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('user_id, phone')
      .or(`phone.eq.${contactId},phone.eq.${contactId.replace('+', '')}`);

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
