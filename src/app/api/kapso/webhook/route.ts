import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Webhook para recibir mensajes de WhatsApp desde Kapso
 * POST /api/kapso/webhook
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`📨 [Webhook-${requestId}] Mensaje recibido desde Kapso`);
    
    const body = await request.json();
    console.log(`📨 [Webhook-${requestId}] Datos recibidos:`, JSON.stringify(body, null, 2));
    
    // Verificar que sea un mensaje de WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      console.log(`⚠️ [Webhook-${requestId}] Objeto no reconocido: ${body.object}`);
      return NextResponse.json({ error: 'Objeto no reconocido' }, { status: 400 });
    }
    
    // Procesar cada entrada
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              await processMessage(change.value, requestId);
            }
          }
        }
      }
    }
    
    console.log(`✅ [Webhook-${requestId}] Mensaje procesado exitosamente`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error(`❌ [Webhook-${requestId}] Error procesando webhook:`, error);
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

async function processMessage(messageData: any, requestId: string) {
  try {
    console.log(`📱 [Webhook-${requestId}] Procesando mensaje:`, messageData);
    
    // Extraer información del mensaje
    const phoneNumberId = messageData.metadata?.phone_number_id;
    const messages = messageData.messages || [];
    
    for (const message of messages) {
      const from = message.from;
      const messageId = message.id;
      const timestamp = message.timestamp;
      const messageType = message.type;
      
      let messageText = '';
      let messageContent = null;
      
      // Extraer contenido según el tipo de mensaje
      switch (messageType) {
        case 'text':
          messageText = message.text?.body || '';
          messageContent = { text: messageText };
          break;
        case 'image':
          messageContent = {
            image: {
              id: message.image?.id,
              caption: message.image?.caption || ''
            }
          };
          messageText = `[Imagen] ${message.image?.caption || ''}`;
          break;
        case 'document':
          messageContent = {
            document: {
              id: message.document?.id,
              filename: message.document?.filename,
              caption: message.document?.caption || ''
            }
          };
          messageText = `[Documento] ${message.document?.filename || ''}`;
          break;
        case 'audio':
          messageContent = {
            audio: {
              id: message.audio?.id,
              voice: message.audio?.voice || false
            }
          };
          messageText = '[Audio]';
          break;
        case 'video':
          messageContent = {
            video: {
              id: message.video?.id,
              caption: message.video?.caption || ''
            }
          };
          messageText = `[Video] ${message.video?.caption || ''}`;
          break;
        default:
          messageText = `[${messageType}]`;
          messageContent = { type: messageType };
      }
      
      console.log(`💬 [Webhook-${requestId}] Mensaje de ${from}: ${messageText}`);
      
      // Buscar el usuario propietario del número de WhatsApp
      const { data: configData, error: configError } = await supabase
        .from('whatsapp_configs')
        .select('user_id, phone_number')
        .eq('phone_number', phoneNumberId)
        .single();
      
      if (configError || !configData) {
        console.log(`⚠️ [Webhook-${requestId}] No se encontró configuración para phone_number_id: ${phoneNumberId}`);
        continue;
      }
      
      const userId = configData.user_id;
      console.log(`👤 [Webhook-${requestId}] Mensaje para usuario: ${userId}`);
      
      // Guardar el mensaje en la base de datos
      const { data: messageRecord, error: saveError } = await supabase
        .from('messages')
        .insert({
          user_id: userId,
          from_number: from,
          to_number: configData.phone_number,
          message_id: messageId,
          message_type: messageType,
          message_text: messageText,
          message_content: messageContent,
          timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
          direction: 'inbound',
          status: 'received',
          platform: 'whatsapp',
          kapso_message_id: messageId
        })
        .select()
        .single();
      
      if (saveError) {
        console.error(`❌ [Webhook-${requestId}] Error guardando mensaje:`, saveError);
      } else {
        console.log(`✅ [Webhook-${requestId}] Mensaje guardado:`, messageRecord.id);
      }
    }
    
  } catch (error: any) {
    console.error(`❌ [Webhook-${requestId}] Error procesando mensaje:`, error);
  }
}

/**
 * Verificar webhook (GET para verificación de Kapso)
 * GET /api/kapso/webhook
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  
  console.log('🔍 Verificación de webhook:', { mode, token, challenge });
  
  // Verificar el token (deberías configurar esto en Kapso)
  const verifyToken = process.env.KAPSO_WEBHOOK_VERIFY_TOKEN || 'gastronomy-saas-webhook-token';
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verificado exitosamente');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.log('❌ Webhook no verificado');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}