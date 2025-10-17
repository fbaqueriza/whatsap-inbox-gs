import { NextRequest, NextResponse } from 'next/server';
import { KapsoSupabaseService } from '../../../../lib/kapsoSupabaseService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🔧 CACHE para evitar procesamiento duplicado
const processedMessages = new Set<string>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Limpiar cache periódicamente
setInterval(() => {
  processedMessages.clear();
}, CACHE_DURATION);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `kapso_supabase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`📥 [${requestId}] ===== KAPSO SUPABASE EVENT RECIBIDO =====`);
    const body = await request.json();
    
    // 🔧 DEDUPLICACIÓN: Crear hash del body para evitar procesamiento duplicado
    const bodyHash = JSON.stringify(body);
    if (processedMessages.has(bodyHash)) {
      console.log(`🔄 [${requestId}] Evento duplicado detectado, ignorando...`);
      return NextResponse.json({
        status: 'ok',
        processed: false,
        reason: 'duplicate',
        requestId,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }
    
    processedMessages.add(bodyHash);
    console.log(`📥 [${requestId}] Body completo recibido:`, JSON.stringify(body, null, 2));

    // Detectar si es un webhook de WhatsApp (formato Meta) o evento de Kapso
    if (body.object === 'whatsapp_business_account' && body.entry) {
      console.log(`📱 [${requestId}] Procesando webhook de WhatsApp desde Kapso`);
      
      // Procesar cada entrada del webhook
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value?.messages) {
              // Procesar mensajes recibidos usando el servicio optimizado
              for (const message of change.value.messages) {
                // 🔧 DEDUPLICACIÓN: Verificar si el mensaje ya fue procesado
                const messageKey = `whatsapp_${message.id}`;
                if (processedMessages.has(messageKey)) {
                  console.log(`🔄 [${requestId}] Mensaje ${message.id} ya procesado, ignorando...`);
                  continue;
                }
                processedMessages.add(messageKey);
                
                console.log(`📨 [${requestId}] Sincronizando mensaje: ${message.id} de ${message.from}`);
                
                // Extraer información del mensaje
                const conversationId = `conv_${message.from}_${Date.now()}`;
                const phoneNumber = message.from;
                const contactName = change.value.contacts?.[0]?.profile?.name || null;
                const messageId = message.id;
                const fromNumber = message.from;
                const toNumber = change.value.metadata?.display_phone_number || 'unknown';
                const content = message.text?.body || '';
                const messageType = message.type;
                const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
                
                // Obtener user_id del contexto (esto debería venir del webhook de Kapso)
                // Por ahora, usar el primer usuario disponible o crear uno temporal
                // Usar el usuario actual logueado
                const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';
                console.log(`👤 [${requestId}] Usando usuario actual: ${userId}`);
                
                // Sincronizar usando el servicio optimizado
                const syncResult = await KapsoSupabaseService.syncKapsoData({
                  conversationId,
                  phoneNumber,
                  contactName,
                  messageId,
                  fromNumber,
                  toNumber,
                  content,
                  messageType,
                  timestamp,
                  userId
                });

                if (syncResult.success) {
                  console.log(`✅ [${requestId}] Mensaje sincronizado exitosamente:`, syncResult.data);
                  console.log(`📡 [${requestId}] Supabase Realtime se encargará de notificar automáticamente`);
                } else {
                  console.error(`❌ [${requestId}] Error sincronizando mensaje:`, syncResult.error);
                }
              }
            }
            
            if (change.field === 'messages' && change.value?.statuses) {
              // Procesar estados de mensajes
              for (const status of change.value.statuses) {
                console.log(`📊 [${requestId}] Estado de mensaje: ${status.status} para ${status.id}`);
                // Los estados se manejan automáticamente por la sincronización
              }
            }
          }
        }
      }
    }
    // Procesar eventos específicos de Kapso (formato personalizado)
    else if (body.type === 'whatsapp.message.received' && body.data) {
      console.log(`📨 [${requestId}] Procesando mensaje de Kapso (formato personalizado)`);
      
      // Procesar cada mensaje en el batch
      for (const item of body.data) {
        if (item.message) {
          const message = item.message;
          const conversation = item.conversation;
          
          // 🔧 DEDUPLICACIÓN: Verificar si el mensaje de Kapso ya fue procesado
          const kapsoMessageKey = `kapso_${message.whatsapp_message_id}`;
          if (processedMessages.has(kapsoMessageKey)) {
            console.log(`🔄 [${requestId}] Mensaje de Kapso ${message.whatsapp_message_id} ya procesado, ignorando...`);
            continue;
          }
          processedMessages.add(kapsoMessageKey);
          
          console.log(`📨 [${requestId}] Sincronizando mensaje de Kapso: ${message.whatsapp_message_id}`);
          
          // Extraer información del mensaje
          const conversationId = conversation.id;
          const phoneNumber = message.phone_number;
          const contactName = message.contact_name;
          const messageId = message.whatsapp_message_id;
          const fromNumber = message.phone_number;
          const toNumber = '5491141780300'; // Número de la empresa
          const content = message.content;
          const messageType = message.message_type;
          const timestamp = new Date(message.created_at).toISOString();
          
          // Usar el usuario actual logueado
          const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';
          console.log(`👤 [${requestId}] Usando usuario actual: ${userId}`);
          
          // Verificar que el usuario existe en la base de datos
          try {
            const { data: user, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('id', userId)
              .single();
            
            if (userError || !user) {
              console.log(`⚠️ [${requestId}] Usuario no encontrado, pero continuando con: ${userId}`);
            }
          } catch (error) {
            console.log(`⚠️ [${requestId}] Error obteniendo usuario, usando usuario por defecto: ${userId}`);
          }
          
          // Sincronizar usando el servicio optimizado
          const syncResult = await KapsoSupabaseService.syncKapsoData({
            conversationId,
            phoneNumber,
            contactName,
            messageId,
            fromNumber,
            toNumber,
            content,
            messageType,
            timestamp,
            userId
          });

          if (syncResult.success) {
            console.log(`✅ [${requestId}] Mensaje de Kapso sincronizado exitosamente:`, syncResult.data);
          } else {
            console.error(`❌ [${requestId}] Error sincronizando mensaje de Kapso:`, syncResult.error);
          }
        }
      }
    }
    else if (body.type === 'order_update' && body.payload?.orderId) {
      console.log(`🔄 [${requestId}] Procesando actualización de orden desde Kapso: ${body.payload.orderId}`);
      
      // Emitir evento directamente a Supabase Realtime
      const { error: broadcastError } = await supabase
        .channel('orders-updates')
        .send({
          type: 'broadcast',
          event: 'order_updated',
          payload: {
            orderId: body.payload.orderId,
            status: body.payload.status,
            timestamp: new Date().toISOString(),
            source: 'kapso'
          }
        });

      if (broadcastError) {
        console.error(`❌ [${requestId}] Error emitiendo evento a Supabase:`, broadcastError);
      } else {
        console.log(`✅ [${requestId}] Evento emitido exitosamente a Supabase Realtime`);
      }
    }

    if (body.type === 'message_received' && body.payload?.messageId) {
      console.log(`📨 [${requestId}] Procesando mensaje recibido desde Kapso: ${body.payload.messageId}`);
      
      // Emitir evento para mensajes
      const { error: broadcastError } = await supabase
        .channel('messages-updates')
        .send({
          type: 'broadcast',
          event: 'message_received',
          payload: {
            messageId: body.payload.messageId,
            content: body.payload.content,
            timestamp: new Date().toISOString(),
            source: 'kapso'
          }
        });

      if (broadcastError) {
        console.error(`❌ [${requestId}] Error emitiendo evento de mensaje:`, broadcastError);
      } else {
        console.log(`✅ [${requestId}] Evento de mensaje emitido exitosamente`);
      }
    }

    if (body.type === 'document_processed' && body.payload?.documentId) {
      console.log(`📎 [${requestId}] Procesando documento procesado desde Kapso: ${body.payload.documentId}`);
      
      // Emitir evento para documentos
      const { error: broadcastError } = await supabase
        .channel('documents-updates')
        .send({
          type: 'broadcast',
          event: 'document_processed',
          payload: {
            documentId: body.payload.documentId,
            orderId: body.payload.orderId,
            status: body.payload.status,
            timestamp: new Date().toISOString(),
            source: 'kapso'
          }
        });

      if (broadcastError) {
        console.error(`❌ [${requestId}] Error emitiendo evento de documento:`, broadcastError);
      } else {
        console.log(`✅ [${requestId}] Evento de documento emitido exitosamente`);
      }
    }

    return NextResponse.json({ 
      status: 'ok', 
      processed: true, 
      requestId,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error(`❌ [${requestId}] Error procesando evento de Kapso:`, error);
    return NextResponse.json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId 
    }, { status: 500 });
  }
}
