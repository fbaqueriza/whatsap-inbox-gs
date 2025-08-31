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
  
  try {
    // 🔧 LOG CRÍTICO: Siempre loguear para debugging
    console.log('🚀 WEBHOOK INICIADO:', new Date().toISOString());
    
    const body = await request.json();
    console.log('📥 Webhook recibido:', JSON.stringify(body, null, 2));

    // Verificar que es un mensaje de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      console.log('✅ Es un mensaje de WhatsApp Business Account');
      
      const entry = body.entry?.[0];
      if (entry?.changes?.[0]?.value?.messages) {
        const messages = entry.changes[0].value.messages;
        console.log(`📱 Procesando ${messages.length} mensajes`);
        
        let processedCount = 0;
        for (const message of messages) {
          try {
            await processWhatsAppMessage(message);
            processedCount++;
          } catch (error) {
            console.error('❌ Error procesando mensaje individual:', error);
          }
        }
        console.log(`✅ Procesados ${processedCount}/${messages.length} mensajes`);
      } else {
        console.log('⚠️ No se encontraron mensajes en el webhook');
      }
    } else {
      console.log('❌ No es un mensaje de WhatsApp Business Account');
    }

    const duration = Date.now() - startTime;
    console.log(`🏁 WEBHOOK COMPLETADO en ${duration}ms`);
    
    return NextResponse.json({ status: 'ok', processed: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Error procesando webhook:', error);
    console.error(`💥 WEBHOOK FALLÓ en ${duration}ms`);
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      duration: duration 
    }, { status: 500 });
  }
}

async function processWhatsAppMessage(message: any) {
  const messageStartTime = Date.now();
  
  try {
    const { from, text, timestamp } = message;
    
    console.log('📱 Procesando mensaje de WhatsApp:', {
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
    const saveResult = await saveMessageWithUserId(normalizedFrom, text?.body, timestamp);
    
    if (saveResult.success) {
      console.log(`✅ Mensaje guardado con user_id: ${saveResult.userId}`);
    } else {
      console.log(`❌ Error guardando mensaje: ${saveResult.error}`);
    }

    // Procesar respuesta del proveedor
    if (text?.body) {
      console.log('🔄 Iniciando processProviderResponse para:', normalizedFrom);
      
      const success = await OrderNotificationService.processProviderResponse(normalizedFrom, text.body);
      
      if (success) {
        console.log('✅ Respuesta del proveedor procesada exitosamente');
      } else {
        console.log('ℹ️ No se encontró pedido pendiente para este número:', normalizedFrom);
      }
    } else {
      console.log('⚠️ Mensaje sin texto recibido de:', normalizedFrom);
    }
    
    const duration = Date.now() - messageStartTime;
    console.log(`✅ Mensaje procesado en ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - messageStartTime;
    console.error('❌ Error procesando mensaje de WhatsApp:', error);
    console.error(`💥 Mensaje falló en ${duration}ms`);
    
    if (error instanceof Error) {
      console.error('❌ Stack trace:', error.stack);
    }
  }
}

// 🔧 FUNCIÓN MEJORADA: Guardar mensaje con user_id asignado automáticamente
async function saveMessageWithUserId(contactId: string, content: string, timestamp: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Variables de entorno faltantes para guardar mensaje');
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
      console.error('❌ Error buscando proveedor:', providersError);
      return { success: false, error: 'Error buscando proveedor' };
    }

    let userId = null;
    if (providers && providers.length > 0) {
      userId = providers[0].user_id; // Este es el user_id del usuario de la app
      console.log(`✅ Encontrado usuario de la app ${userId} para proveedor ${contactId}`);
    } else {
      console.log(`⚠️ No se encontró usuario de la app para proveedor ${contactId}`);
    }

    // Guardar mensaje con user_id del usuario de la app
    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert([{
        content: content,
        message_type: 'received',
        status: 'delivered',
        contact_id: contactId, // Número del proveedor
        user_id: userId, // ID del usuario de la app
        message_sid: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
        created_at: new Date().toISOString()
      }]);

    if (saveError) {
      console.error('❌ Error guardando mensaje:', saveError);
      return { success: false, error: saveError.message };
    } else {
      console.log(`✅ Mensaje guardado con user_id del usuario de la app: ${userId || 'null'}`);
      return { success: true, userId: userId };
    }
  } catch (error) {
    console.error('❌ Error en saveMessageWithUserId:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
