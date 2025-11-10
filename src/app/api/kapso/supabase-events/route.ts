import { NextRequest, NextResponse } from 'next/server';
// import { KapsoSupabaseService } from '../../../../lib/kapsoSupabaseService';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneNumber } from '../../../../lib/phoneNormalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// 🔧 CRÍTICO: Crear dos clientes - uno para operaciones que necesitan service role (storage)
// y otro para operaciones que necesitan disparar Realtime (anon key)
const supabase = createClient(supabaseUrl, supabaseServiceKey); // Para storage y operaciones admin
const supabaseRealtime = createClient(
  supabaseUrl, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // 🔧 CRÍTICO: Anon key para disparar Realtime
);

// 🔧 CACHE para evitar procesamiento duplicado
const processedMessages = new Set<string>();

// ✅ CORRECCIÓN: Limpiar mensajes procesados cada 10 minutos para evitar memoria infinita
setInterval(() => {
  if (processedMessages.size > 1000) {
    processedMessages.clear();
    console.log('🧹 [Webhook] Limpiando cache de mensajes procesados');
  }
}, 10 * 60 * 1000); // 10 minutos
const emittedEvents = new Set<string>();
const processedOrderFlows = new Set<string>(); // Nuevo: evitar duplicación del flujo de órdenes
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Limpiar cache periódicamente
setInterval(() => {
  processedMessages.clear();
  emittedEvents.clear();
  processedOrderFlows.clear();
}, CACHE_DURATION);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `kapso_supabase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`📥 [${requestId}] ===== KAPSO SUPABASE EVENT RECIBIDO =====`);
    
    // ✅ DEBUG: Log de headers para verificar configuración
    console.log(`🔍 [${requestId}] Headers recibidos:`, {
      'x-kapso-signature': request.headers.get('x-kapso-signature'),
      'x-hub-signature-256': request.headers.get('x-hub-signature-256'),
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent')
    });
    
    // ✅ VALIDACIÓN DEL SECRETO DEL WEBHOOK
    const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET || '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb';
    const signature = request.headers.get('x-kapso-signature') || request.headers.get('x-hub-signature-256');
    
    if (signature && !signature.includes(webhookSecret)) {
      console.error(`❌ [${requestId}] Webhook signature inválida: ${signature}`);
      return NextResponse.json({ 
        status: 'error', 
        message: 'Invalid webhook signature',
        requestId 
      }, { status: 401 });
    } else if (signature) {
      console.log(`✅ [${requestId}] Webhook signature válida: ${signature}`);
    } else {
      console.log(`⚠️ [${requestId}] No se encontró signature en headers`);
    }
    
    const body = await request.json();
    
    // 🔍 DEBUG: Log del body para debugging (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [${requestId}] Body recibido:`, {
        type: body.type,
        dataCount: body.data?.length || 0,
        hasData: !!body.data,
        hasEntry: !!body.entry
      });
    }
    
    // ✅ CORRECCIÓN: Usar ID específico del mensaje para deduplicación
    let messageId = null;
    if (body.type === 'whatsapp.message.received' && body.data?.[0]?.message?.id) {
      messageId = body.data[0].message.id;
    } else if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id) {
      messageId = body.entry[0].changes[0].value.messages[0].id;
    }
    
    if (messageId && processedMessages.has(messageId)) {
      console.log(`🔄 [${requestId}] Mensaje duplicado detectado (${messageId}), ignorando completamente...`);
      console.log(`🔄 [${requestId}] Mensajes procesados actualmente:`, Array.from(processedMessages));
      
      // ✅ CORRECCIÓN: NO enviar broadcast para mensajes duplicados
      // El broadcast ya se envió la primera vez
      return NextResponse.json({
        status: 'ok',
        processed: false,
        reason: 'duplicate_ignored',
        requestId,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }
    
    if (messageId) {
      processedMessages.add(messageId);
    }
    console.log(`📥 [${requestId}] Body completo recibido:`, JSON.stringify(body, null, 2));

    // Detectar si es un webhook de WhatsApp (formato Meta) o evento de Kapso
    if (body.object === 'whatsapp_business_account' && body.entry) {
      console.log(`📱 [${requestId}] Procesando webhook de WhatsApp desde Kapso`);
    } else if (body.type === 'whatsapp.message.received' && body.data) {
      console.log(`📨 [${requestId}] Procesando mensaje de Kapso (formato personalizado)`);
      
      // Procesar mensajes de Kapso en formato personalizado
      for (const item of body.data) {
        const message = item.message;
        const conversation = item.conversation;
        const whatsappConfig = item.whatsapp_config;
        
        console.log(`📨 [${requestId}] Sincronizando mensaje de Kapso: ${message.id}`);
        
        // ✅ RESOLVER userId desde whatsapp_config_id
        let userId: string | null = null;
        if (whatsappConfig?.id) {
          const { data: userConfig } = await supabase
            .from('user_whatsapp_config')
            .select('user_id')
            .eq('kapso_config_id', whatsappConfig.id)
            .single();
          userId = userConfig?.user_id || null;
          console.log(`👤 [${requestId}] Usuario resuelto desde whatsapp_config: ${userId}`);
        }
        
        if (!userId) {
          console.error(`❌ [${requestId}] No se pudo resolver userId desde whatsapp_config`);
          continue; // Skip this message
        }
        
        // Extraer información del mensaje (formato Kapso v2)
        const messageId = message.id;
        // Kapso v2 usa conversation_phone_number en lugar de from
        const fromNumber = message.conversation_phone_number || message.from || message.phone_number;
        // Kapso v2 usa content en lugar de text.body
        const content = message.content || message.text?.body || '';
        // Kapso v2 usa message_type en lugar de type
        const messageType = message.message_type || message.type;
        // Validar timestamp antes de convertir - Kapso v2 usa metadata.timestamp
        let timestamp: string;
        const timestampValue = message.metadata?.timestamp || message.timestamp;
        if (timestampValue && !isNaN(parseInt(timestampValue))) {
          timestamp = new Date(parseInt(timestampValue) * 1000).toISOString();
        } else {
          // Si no hay timestamp válido, usar la fecha actual
          timestamp = new Date().toISOString();
          console.warn(`⚠️ [${requestId}] Timestamp inválido o faltante, usando fecha actual`);
        }
        const contactName = conversation.contact_name || fromNumber;
        
        console.log(`👤 [${requestId}] Usando usuario actual: ${userId}`);
        
        // ✅ NUEVO: Procesar documentos de Kapso (formato Kapso v2)
        // Kapso v2 usa media_data en lugar de message.document
        const mediaData = message.media_data || message.kapso?.media_info || message.document;
        if (messageType === 'document' && (message.kapso?.has_media || message.has_media || mediaData)) {
          console.log(`📎 [${requestId}] ✅ DOCUMENTO DETECTADO - Procesando documento de Kapso:`, {
            filename: message.filename || mediaData?.filename,
            mimeType: message.mime_type || mediaData?.mime_type || mediaData?.content_type,
            url: mediaData?.url || message.document?.url || message.document?.link,
            fileSize: mediaData?.byte_size || mediaData?.file_size || message.document?.file_size
          });
          
          const documentData = {
            filename: message.filename || mediaData?.filename,
            mimeType: message.mime_type || mediaData?.mime_type || mediaData?.content_type,
            url: mediaData?.url || message.document?.url || message.document?.link || message.kapso?.mediaUrl,
            id: messageId,
            fileSize: mediaData?.byte_size || mediaData?.file_size || message.document?.file_size
          };
          
          // 🔧 RESTAURAR FLUJO ANTERIOR: Usar processKapsoDocumentWithOCR como funcionaba antes
          try {
            console.log(`🔄 [${requestId}] Procesando documento con flujo anterior (restaurado)...`);
            
            await processKapsoDocumentWithOCR(
              fromNumber,
              documentData,
              requestId,
              userId,
              supabase // 🔧 RESTAURAR: Usar supabase (SERVICE_ROLE_KEY) como antes
            );
            
          } catch (docError) {
            console.error(`❌ [${requestId}] Error procesando documento de Kapso:`, docError);
          }
        }
        
        console.log(`📨 [${requestId}] Mensaje de Kapso disponible:`, {
          messageId: messageId,
          fromNumber: fromNumber,
          content: content,
          messageType: messageType,
          timestamp: timestamp,
          contactName: contactName
        });
        
        // ✅ CORRECCIÓN: Procesar flujo de órdenes para mensajes de texto
        if (messageType === 'text' && content && content.trim().length > 0) {
          try {
            console.log(`🔄 [${requestId}] Procesando flujo de órdenes para mensaje de texto...`);
            const { ExtensibleOrderFlowService } = await import('../../../../lib/extensibleOrderFlowService');
            const orderFlowService = new ExtensibleOrderFlowService();
            const flowResult = await orderFlowService.processProviderMessage(fromNumber, content, userId);
            
            if (flowResult.success) {
              console.log(`✅ [${requestId}] Flujo de órdenes procesado exitosamente:`, flowResult);
            } else {
              console.log(`ℹ️ [${requestId}] No se procesó flujo de órdenes:`, flowResult.message);
            }
          } catch (flowError) {
            console.error(`❌ [${requestId}] Error procesando flujo de órdenes:`, flowError);
          }
          
          // ✅ CORRECCIÓN: Guardar mensaje de texto en Supabase
          try {
            // ✅ CORRECCIÓN RAÍZ: Normalizar contact_id para evitar contactos duplicados
            const normalizedContactId = normalizePhoneNumber(fromNumber).normalized;
            
            const messageData = {
              id: crypto.randomUUID(),
              content: content,
              timestamp: timestamp,
              contact_id: normalizedContactId, // Usar número normalizado
              user_id: userId,
              message_type: 'received',
              status: 'received',
              message_sid: messageId,
              created_at: timestamp
              // ✅ CORRECCIÓN: contact_name no existe en la tabla, se obtiene de la conversación
            };
            
            console.log(`💾 [${requestId}] Guardando mensaje de texto en Supabase:`, messageData);
            
            const { error: insertError } = await supabase
              .from('whatsapp_messages')
              .insert([messageData]);
            
            if (insertError) {
              console.error(`❌ [${requestId}] Error guardando mensaje de texto en Supabase:`, insertError);
            } else {
              console.log(`✅ [${requestId}] Mensaje de texto guardado en Supabase exitosamente`);
              
              // ✅ CORRECCIÓN: No es necesario broadcast - Supabase Realtime ya dispara el evento automáticamente
              // El RealtimeService está suscrito a postgres_changes en whatsapp_messages
              console.log(`✅ [${requestId}] Mensaje guardado - Realtime se disparará automáticamente`);
                
              // ✅ NUEVO: Marcar automáticamente como leído en Kapso (solo para mensajes reales)
              try {
                // ✅ CORRECCIÓN: Usar el whatsapp_message_id de Kapso, no el ID de Supabase
                const kapsoMessageId = messageData.message_sid;
                
                // ✅ FILTRO: Solo intentar marcar como leído si es un mensaje real de Kapso (no de prueba)
                if (kapsoMessageId && !kapsoMessageId.startsWith('test_')) {
                  console.log(`📖 [${requestId}] Marcando mensaje como leído en Kapso: ${kapsoMessageId}`);
                  
                  const apiUrl = `http://localhost:3001/api/kapso/chat`;
                  console.log(`📖 [${requestId}] URL de API: ${apiUrl}`);
                  
                  const markReadResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      action: 'mark-read',
                      messageId: kapsoMessageId
                    }),
                  });
                  
                  console.log(`📖 [${requestId}] Respuesta de API: ${markReadResponse.status} ${markReadResponse.statusText}`);
                  
                  if (markReadResponse.ok) {
                    const responseData = await markReadResponse.json();
                    console.log(`✅ [${requestId}] Mensaje marcado como leído en Kapso: ${kapsoMessageId}`, responseData);
                  } else {
                    const errorData = await markReadResponse.text();
                    console.warn(`⚠️ [${requestId}] Error marcando mensaje como leído en Kapso: ${kapsoMessageId}`, errorData);
                    
                    // ✅ NUEVO: Si es error 404, el mensaje no existe en Kapso - esto es normal
                    if (markReadResponse.status === 404) {
                      console.log(`ℹ️ [${requestId}] Mensaje no encontrado en Kapso (404) - esto puede ser normal si el mensaje no existe en Kapso`);
                    }
                  }
                } else {
                  console.log(`ℹ️ [${requestId}] Saltando auto mark-read para mensaje de prueba`);
                }
              } catch (markReadError) {
                console.warn(`⚠️ [${requestId}] Error marcando mensaje como leído en Kapso:`, markReadError);
              }
            }
          } catch (textError) {
            console.error(`❌ [${requestId}] Error procesando mensaje de texto:`, textError);
          }
        }
        
        // ✅ CORRECCIÓN: Broadcast ya se envió después del guardado exitoso
      }
      
      return NextResponse.json({
        status: 'ok',
        processed: true,
        requestId,
        timestamp: new Date().toISOString()
      });
    } else if (body.object === 'whatsapp_business_account' && body.entry) {
      console.log(`📱 [${requestId}] Procesando webhook de WhatsApp desde Kapso`);
      
      // Procesar cada entrada del webhook
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value?.messages) {
              // ✅ CORRECCIÓN RAÍZ: Procesar mensajes reales, no solo estados
              console.log(`📨 [${requestId}] Procesando ${change.value.messages.length} mensajes reales`);
              console.log(`📨 [${requestId}] Mensajes recibidos:`, JSON.stringify(change.value.messages, null, 2));
              for (const message of change.value.messages) {
                // ✅ DEDUPLICACIÓN MEJORADA: Incluir timestamp del mensaje
                const messageTimestamp = message.timestamp;
                const messageKey = `whatsapp_${message.id}_${messageTimestamp}`;
                if (processedMessages.has(messageKey)) {
                  console.log(`🔄 [${requestId}] Mensaje ${message.id} con timestamp ${messageTimestamp} ya procesado, ignorando...`);
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
                
                // ✅ CORRECCIÓN RAÍZ: Extraer información de documentos
                const documentData = message.document ? {
                  filename: message.document.filename,
                  mimeType: message.document.mime_type,
                  sha256: message.document.sha256,
                  id: message.document.id,
                  url: message.document.url
                } : null;
                
                console.log(`🔍 [${requestId}] Mensaje tipo: ${messageType}, tiene documento: ${!!documentData}`);
                console.log(`📊 [${requestId}] Detalles del mensaje:`, {
                  messageType,
                  hasDocument: !!message.document,
                  documentKeys: message.document ? Object.keys(message.document) : [],
                  messageKeys: Object.keys(message),
                  fullMessage: JSON.stringify(message, null, 2)
                });
                
                // Obtener user_id del contexto (esto debería venir del webhook de Kapso)
                // Por ahora, usar el primer usuario disponible o crear uno temporal
                // Usar el usuario actual logueado
                // userId ya definido arriba
                // ✅ CORRECCIÓN RAÍZ: Usar el usuario correcto para webhooks
                console.log(`👤 [${requestId}] Usando usuario correcto para webhook: ${userId}`);
                
                // ✅ CORRECCIÓN: No sincronizar con Supabase, usar solo Kapso como almacén
                // Los mensajes se almacenan en Kapso, solo notificamos al frontend para que recargue
                console.log(`📨 [${requestId}] Mensaje recibido y almacenado en Kapso:`, {
                  messageId,
                  fromNumber,
                  content,
                  messageType,
                  documentData: documentData ? {
                    filename: documentData.filename,
                    mimeType: documentData.mimeType,
                    hasUrl: !!documentData.url
                  } : null,
                  message: message // Agregar el objeto message completo para debug
                });

                // Notificar al frontend que hay nuevos mensajes disponibles en Kapso
                console.log(`📡 [${requestId}] Notificando al frontend sobre nuevo mensaje en Kapso`);
                
                // ✅ DEDUPLICACIÓN MEJORADA: Incluir timestamp para mayor precisión
                const eventTimestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
                const eventKey = `event_${messageId}_${fromNumber}_${eventTimestamp}`;
                
                if (emittedEvents.has(eventKey)) {
                  console.log(`🔄 [${requestId}] Evento ya emitido para mensaje ${messageId} con key ${eventKey}, ignorando...`);
                } else {
                  emittedEvents.add(eventKey);
                  console.log(`✅ [${requestId}] Emitiendo evento nuevo para mensaje ${messageId} con key ${eventKey}`);
                  
                  // ✅ CORRECCIÓN: No enviar broadcast duplicado - ya se envió arriba para mensajes de texto
                }
                  
                // 🔧 NUEVO: Procesar documentos si es un documento
                console.log(`🔍 [${requestId}] Verificando si es documento:`, {
                  messageType,
                  hasDocumentData: !!documentData,
                  documentData: documentData,
                  messageKeys: Object.keys(message),
                  hasDocument: !!message.document
                });
                
                // ✅ SISTEMA ANTERIOR FUNCIONAL: Procesar documentos correctamente
                if (messageType === 'document' && documentData) {
                    try {
                      console.log(`📎 [${requestId}] ✅ DOCUMENTO DETECTADO - Procesando documento recibido:`, {
                        filename: documentData.filename,
                        mimeType: documentData.mimeType,
                        url: documentData.url
                      });
                      
                      // Procesar documento con el sistema anterior funcional
                      const { kapsoDocumentProcessor } = await import('../../../../lib/kapsoDocumentProcessor');
                      await kapsoDocumentProcessor.processDocument(
                        fromNumber,
                        documentData,
                        userId,
                        requestId,
                        supabaseRealtime // 🔧 CRÍTICO: Usar cliente con anon key para disparar Realtime
                      );
                    } catch (docError) {
                      console.error(`❌ [${requestId}] Error procesando documento:`, docError);
                    }
                  }
                  
                  // ✅ CORRECCIÓN: Procesar flujo de órdenes para mensajes reales del proveedor
                  if ((messageType === 'text' && content) || messageType === 'document') {
                    try {
                      console.log(`🔄 [${requestId}] Procesando flujo de órdenes para mensaje de proveedor:`, {
                        phone: fromNumber,
                        messageType: messageType,
                        message: content,
                        userId: userId
                      });
                      
                      // Verificar si es un proveedor
                      const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
                      const normalizedFromNumber = PhoneNumberService.normalizePhoneNumber(fromNumber);
                      
                      console.log(`📞 [${requestId}] Teléfono original: ${fromNumber}, normalizado: ${normalizedFromNumber}`);
                      
                      const { data: provider } = await supabase
                        .from('providers')
                        .select('id, user_id, name')
                        .eq('phone', normalizedFromNumber)
                        .eq('user_id', userId)  // ✅ FILTRAR POR USUARIO
                        .single();
                      
                      if (provider) {
                        console.log(`👤 [${requestId}] Proveedor encontrado:`, {
                          id: provider.id,
                          name: provider.name,
                          userId: provider.user_id
                        });
                        
                        // ✅ PROTECCIÓN CONTRA DUPLICACIÓN: Crear clave única para este procesamiento
                        const messageHash = content?.substring(0, 50) || 'document';
                        const orderFlowKey = `orderflow_${provider.user_id}_${normalizedFromNumber}_${messageHash}_${Math.floor(parseInt(messageTimestamp) / 60)}`;
                        
                        if (processedOrderFlows.has(orderFlowKey)) {
                          console.log(`🔄 [${requestId}] Flujo de órdenes ya procesado para ${orderFlowKey}, ignorando...`);
                        } else {
                          processedOrderFlows.add(orderFlowKey);
                          console.log(`✅ [${requestId}] Procesando flujo de órdenes con clave: ${orderFlowKey}`);
                          
                          // Procesar flujo de órdenes en background para evitar bloqueos
                          setTimeout(async () => {
                            try {
                              console.log(`🚀 [${requestId}] Importando ExtensibleOrderFlowService...`);
                              const { ExtensibleOrderFlowService } = await import('../../../../lib/extensibleOrderFlowService');
                              const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
                              
                              console.log(`🔄 [${requestId}] Llamando a processProviderMessage...`);
                              
                              // Para documentos, usar un mensaje especial que indique que se recibió un documento
                              const messageForOrderFlow = messageType === 'document' ? 'documento_recibido' : content;
                              
                              const orderResult = await extensibleOrderFlowService.processProviderMessage(
                                normalizedFromNumber, 
                                messageForOrderFlow, 
                                provider.user_id
                              );
                              
                              console.log(`📊 [${requestId}] Resultado del flujo de órdenes:`, orderResult);
                              
                              if (orderResult.success) {
                                console.log(`✅ [${requestId}] Flujo de órdenes procesado: ${orderResult.newStatus}`);
                              } else {
                                console.log(`⚠️ [${requestId}] Flujo de órdenes no procesado: ${orderResult.message || orderResult.errors?.join(', ')}`);
                              }
                            } catch (orderError) {
                              console.error(`❌ [${requestId}] Error procesando flujo de órdenes:`, orderError);
                            }
                          }, 100); // Pequeño delay para no bloquear la respuesta del webhook
                        }
                      } else {
                        console.log(`ℹ️ [${requestId}] No es un proveedor registrado, saltando flujo de órdenes`);
                      }
                    } catch (orderError) {
                      console.error(`❌ [${requestId}] Error procesando flujo de órdenes:`, orderError);
                    }
                  }
              }
            }
            
            if (change.field === 'messages' && change.value?.statuses) {
              // Procesar estados de mensajes
              for (const status of change.value.statuses) {
                console.log(`📊 [${requestId}] Estado de mensaje: ${status.status} para ${status.id}`);
                
                // ✅ CORRECCIÓN: Solo procesar estados 'read' reales, no de entrega
                // Los webhooks de WhatsApp a veces envían 'read' cuando se entrega, no cuando se lee
                if (status.status === 'read') {
                  // Verificar si es un estado 'read' real comparando timestamps
                  const messageTimestamp = parseInt(status.timestamp) * 1000;
                  const currentTime = Date.now();
                  const timeDifference = currentTime - messageTimestamp;
                  
                  // Solo procesar si el mensaje fue "leído" recientemente (menos de 5 minutos)
                  // Esto evita procesar estados 'read' de mensajes antiguos
                  if (timeDifference < 300000) { // 5 minutos en milisegundos
                    console.log(`📖 [${requestId}] Estado 'read' real detectado para ${status.id} (diferencia: ${Math.round(timeDifference/1000)}s)`);
                    
                    try {
                      const broadcastResult = await supabase
                        .channel('message-status-updates')
        .send({
          type: 'broadcast' as const,
          event: 'message_read',
          payload: {
                            messageId: status.id,
                            status: 'read',
                            timestamp: new Date().toISOString(),
                            source: 'kapso'
                          }
                        });

                      if (broadcastResult === 'error') {
                        console.error(`❌ [${requestId}] Error notificando estado de mensaje`);
                      } else {
                        console.log(`✅ [${requestId}] Estado de mensaje notificado al frontend: ${status.id} -> ${status.status}`);
                      }
                    } catch (error) {
                      console.error(`❌ [${requestId}] Error procesando estado de mensaje:`, error);
                    }
                  } else {
                    console.log(`⚠️ [${requestId}] Ignorando estado 'read' antiguo para ${status.id} (diferencia: ${Math.round(timeDifference/1000)}s)`);
                  }
                }
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
          // userId ya definido arriba
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
          
          // ✅ CORRECCIÓN: No sincronizar con Supabase, usar solo Kapso como almacén
          console.log(`📨 [${requestId}] Mensaje de Kapso disponible:`, {
            messageId,
            fromNumber,
            content,
            messageType
          });

          // ✅ CORRECCIÓN RAÍZ: No enviar broadcast duplicado - ya se envió arriba
        }
      }
    }
    else if (body.type === 'order_update' && body.payload?.orderId) {
      console.log(`🔄 [${requestId}] Procesando actualización de orden desde Kapso: ${body.payload.orderId}`);
      
      // Emitir evento directamente a Supabase Realtime
      const broadcastResult = await supabase
        .channel('orders-updates')
        .send({
          type: 'broadcast' as const,
          event: 'order_updated',
          payload: {
            orderId: body.payload.orderId,
            status: body.payload.status,
            timestamp: new Date().toISOString(),
            source: 'kapso'
          }
        });

      if (broadcastResult === 'error') {
        console.error(`❌ [${requestId}] Error emitiendo evento a Supabase`);
      } else {
        console.log(`✅ [${requestId}] Evento emitido exitosamente a Supabase Realtime`);
      }
    }

    if (body.type === 'message_received' && body.payload?.messageId) {
      console.log(`📨 [${requestId}] Procesando mensaje recibido desde Kapso: ${body.payload.messageId}`);
      
      // Emitir evento para mensajes
      const broadcastResult = await supabase
        .channel('messages-updates')
        .send({
          type: 'broadcast' as const,
          event: 'message_received',
          payload: {
            messageId: body.payload.messageId,
            content: body.payload.content,
            timestamp: new Date().toISOString(),
            source: 'kapso'
          }
        });

      if (broadcastResult === 'error') {
        console.error(`❌ [${requestId}] Error emitiendo evento de mensaje`);
      } else {
        console.log(`✅ [${requestId}] Evento de mensaje emitido exitosamente`);
      }
    }

    if (body.type === 'document_processed' && body.payload?.documentId) {
      console.log(`📎 [${requestId}] Procesando documento procesado desde Kapso: ${body.payload.documentId}`);
      
      // Emitir evento para documentos
      const broadcastResult = await supabase
        .channel('documents-updates')
        .send({
          type: 'broadcast' as const,
          event: 'document_processed',
          payload: {
            documentId: body.payload.documentId,
            orderId: body.payload.orderId,
            status: body.payload.status,
            timestamp: new Date().toISOString(),
            source: 'kapso'
          }
        });

      if (broadcastResult === 'error') {
        console.error(`❌ [${requestId}] Error emitiendo evento de documento`);
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

// 🔧 FUNCIÓN AUXILIAR: Procesar documento de Kapso
async function processKapsoDocument(
  fromNumber: string,
  documentData: any,
  requestId: string,
  userId: string,
  supabase: any
): Promise<void> {
  try {
    console.log(`📎 [${requestId}] Procesando documento de Kapso...`);
    
    // Crear mensaje en el chat para mostrar el documento
    const messageId = `kapso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // ✅ MEJORA: Crear contenido más descriptivo para documentos
    const fileExtension = documentData.filename ? documentData.filename.split('.').pop()?.toLowerCase() : '';
    const isInvoice = fileExtension === 'pdf' || documentData.filename?.toLowerCase().includes('factura') || documentData.filename?.toLowerCase().includes('invoice');
    
    const messageData = {
      id: messageId,
      content: isInvoice 
        ? `📄 **Factura recibida**\n\n${documentData.filename}\n\n✅ Documento procesado exitosamente.` 
        : `📎 **Documento recibido**\n\n${documentData.filename}`,
      timestamp: timestamp,
      type: 'received',
      contact_id: normalizePhoneNumber(fromNumber).normalized,
      user_id: userId,
      message_type: 'received',
      status: 'received',
      media_url: documentData.url,
      media_type: documentData.mimeType,
      whatsapp_message_id: documentData.id,
      filename: documentData.filename,
      file_size: null, // No disponible desde Kapso
      isDocument: true,
      documentType: isInvoice ? 'invoice' : 'document'
    };
    
    console.log(`📱 [${requestId}] Documento procesado, notificando al frontend:`, messageData);
    
    // ✅ CORRECCIÓN: Guardar en Supabase para que aparezca en el chat
    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert([messageData]);
    
    if (insertError) {
      console.error(`❌ [${requestId}] Error guardando documento en Supabase:`, insertError);
    } else {
      console.log(`✅ [${requestId}] Documento guardado en Supabase:`, messageId);
    }
    
    // Notificar al frontend
    try {
      const broadcastResult = await supabase
        .channel('kapso_messages')
        .send({
          type: 'broadcast' as const,
          event: 'new_message',
          payload: {
            messageId: messageId,
            fromNumber: fromNumber,
            content: messageData.content,
            messageType: 'document',
            timestamp: timestamp,
            userId: userId,
            mediaUrl: documentData.url,
            filename: documentData.filename,
            isDocument: true,
            documentType: isInvoice ? 'invoice' : 'document'
          }
        });
      
      if (broadcastResult === 'error') {
        console.error(`❌ [${requestId}] Error notificando documento al frontend`);
      } else {
        console.log(`✅ [${requestId}] Documento notificado al frontend exitosamente`);
      }
    } catch (notificationError) {
      console.error(`❌ [${requestId}] Error enviando notificación de documento:`, notificationError);
    }
    
    // ✅ OPTIMIZADO: Usar servicio unificado
    console.log(`🔍 [${requestId}] DIAGNÓSTICO: Llamando a kapsoDocumentProcessor.processDocument`);
    const { kapsoDocumentProcessor } = await import('../../../../lib/kapsoDocumentProcessor');
    const result = await kapsoDocumentProcessor.processDocument(
      fromNumber,
      documentData,
      userId,
      requestId,
      supabaseRealtime // 🔧 CRÍTICO: Usar cliente con anon key para disparar Realtime
    );
    console.log(`🔍 [${requestId}] DIAGNÓSTICO: Resultado de processDocument:`, {
      success: result.success,
      documentId: result.documentId,
      orderId: result.orderId,
      error: result.error
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error procesando documento de Kapso:`, error);
  }
}

// 🔧 FUNCIÓN AUXILIAR: Procesar documento de Kapso con OCR
async function processKapsoDocumentWithOCR(
  fromNumber: string,
  documentData: any,
  requestId: string,
  userId: string,
  supabase: any
): Promise<void> {
  try {
    console.log(`🤖 [${requestId}] Iniciando procesamiento OCR para documento de Kapso...`);
    
    // Obtener proveedor para asociar el documento
    const { PhoneNumberService } = await import('../../../../lib/phoneNumberService');
    const normalizedFromNumber = PhoneNumberService.normalizePhoneNumber(fromNumber);
    
    const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
    const logger = InvoiceOrderLogger.getInstance();
    
    await logger.info(requestId, 'Buscando proveedor para documento de Kapso', {
      fromNumber: fromNumber,
      normalizedFromNumber: normalizedFromNumber,
      userId: userId
    });
    console.log(`🔍 [${requestId}] Buscando proveedor:`, {
      fromNumber: fromNumber,
      normalizedFromNumber: normalizedFromNumber,
      userId: userId
    });
    
    // 🔧 OPTIMIZACIÓN: Búsqueda paralela de proveedor (mejora del sistema optimizado)
    // En lugar de búsqueda secuencial, hacemos todas las búsquedas en paralelo
    const searchVariants = PhoneNumberService.searchVariants(fromNumber);
    const lastDigits = normalizedFromNumber.replace(/\D/g, '').slice(-8);
    
    console.log(`🔍 [${requestId}] Búsqueda optimizada (paralela): exacta + variantes + parcial`);
    
    // 🔧 MEJORA: Búsqueda paralela (exacta + variantes + parcial) en lugar de secuencial
    const [exactResult, variantsResult, partialResult] = await Promise.allSettled([
      // Búsqueda exacta
      supabase
      .from('providers')
      .select('id, name, phone, auto_order_flow_enabled')
      .eq('phone', normalizedFromNumber)
      .eq('user_id', userId)
        .single(),
      
      // Búsqueda por variantes (solo si hay variantes)
      searchVariants.length > 0
        ? supabase
          .from('providers')
          .select('id, name, phone, auto_order_flow_enabled')
            .in('phone', searchVariants)
          .eq('user_id', userId)
            .limit(1)
        : Promise.resolve({ data: null, error: null }),
      
      // Búsqueda parcial (solo si hay suficientes dígitos)
      lastDigits.length >= 8
        ? supabase
          .from('providers')
          .select('id, name, phone, auto_order_flow_enabled')
          .eq('user_id', userId)
          .or(`phone.ilike.%${lastDigits},phone.ilike.${lastDigits}%`)
            .limit(5)
        : Promise.resolve({ data: null, error: null })
    ]);

    // Priorizar: exacta > variantes > parcial
    let provider = null;
    if (exactResult.status === 'fulfilled' && exactResult.value.data) {
      provider = exactResult.value.data;
      await logger.info(requestId, 'Proveedor encontrado (exacta - optimizado)', {
        providerId: provider.id,
        providerName: provider.name,
        matchedPhone: provider.phone
      });
      console.log(`✅ [${requestId}] Proveedor encontrado (exacta): ${provider.name} (${provider.phone})`);
    } else if (variantsResult.status === 'fulfilled' && variantsResult.value.data?.[0]) {
      provider = variantsResult.value.data[0];
      await logger.info(requestId, 'Proveedor encontrado (variante - optimizado)', {
        providerId: provider.id,
        providerName: provider.name,
        matchedPhone: provider.phone
      });
      console.log(`✅ [${requestId}] Proveedor encontrado (variante): ${provider.name} (${provider.phone})`);
    } else if (partialResult.status === 'fulfilled' && partialResult.value.data?.length > 0) {
      const bestMatch = partialResult.value.data.find((p: any) => 
        p.phone.replace(/\D/g, '').slice(-8) === lastDigits
      );
          if (bestMatch) {
            provider = bestMatch;
        await logger.info(requestId, 'Proveedor encontrado (parcial - optimizado)', {
              providerId: provider.id,
              providerName: provider.name,
              matchedPhone: provider.phone,
              lastDigits: lastDigits
            });
        console.log(`✅ [${requestId}] Proveedor encontrado (parcial): ${provider.name} (${provider.phone})`);
      }
    }
    
    // Si aún no se encuentra, mostrar todos los proveedores del usuario para debugging
    if (!provider) {
      const { data: allProviders } = await supabase
        .from('providers')
        .select('id, name, phone')
        .eq('user_id', userId)
        .limit(10);
      
      await logger.warn(requestId, 'Proveedor no encontrado para documento de Kapso', {
        phone: normalizedFromNumber,
        fromNumber: fromNumber,
        userId: userId,
        totalProviders: allProviders?.length || 0,
        sampleProviders: allProviders?.slice(0, 3).map(p => ({ name: p.name, phone: p.phone })) || []
      });
      console.log(`⚠️ [${requestId}] Proveedor no encontrado para teléfono: ${normalizedFromNumber}`);
      console.log(`📋 [${requestId}] Proveedores del usuario (primeros 10):`, allProviders?.map(p => ({ name: p.name, phone: p.phone })) || []);
      console.log(`📋 [${requestId}] Total de proveedores: ${allProviders?.length || 0}`);
      
      // Aún así procesar el documento aunque no se encuentre el proveedor
      // para que aparezca en la lista de documentos
      console.log(`ℹ️ [${requestId}] Procesando documento sin proveedor asociado...`);
      await logger.info(requestId, 'Procesando documento sin proveedor asociado', {
        fromNumber: fromNumber
      });
      // Continuar con el procesamiento pero sin provider_id
      // TODO: Podríamos crear el documento sin provider_id y luego asignarlo manualmente
      // Por ahora, retornar sin procesar el documento
      return;
    }
    
    // Verificar si el flujo automático está habilitado para este proveedor
    const autoOrderFlowEnabled = provider.auto_order_flow_enabled !== false; // Por defecto true si no está definido
    await logger.info(requestId, 'Proveedor encontrado en Kapso', {
      providerId: provider.id,
      providerName: provider.name,
      autoOrderFlowEnabled: autoOrderFlowEnabled
    });
    
    console.log(`👤 [${requestId}] Proveedor encontrado: ${provider.name} (${provider.id}), flujo automático: ${autoOrderFlowEnabled ? 'habilitado' : 'deshabilitado'}`);
    
    if (!autoOrderFlowEnabled) {
      await logger.info(requestId, 'Flujo automático DESHABILITADO - Solo procesando documento sin crear orden', {
        providerId: provider.id
      });
      console.log(`ℹ️ [${requestId}] Flujo automático deshabilitado para este proveedor, solo procesando documento`);
      // Procesar documento pero no crear orden
      // TODO: Podríamos procesar el documento con OCR pero no crear orden
      return;
    }
    
    // Descargar archivo desde la URL de Kapso
    console.log(`📥 [${requestId}] Descargando archivo desde: ${documentData.url}`);
    const downloadResponse = await fetch(documentData.url);
    
    if (!downloadResponse.ok) {
      throw new Error(`Error descargando archivo: ${downloadResponse.status}`);
    }
    
    const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
    console.log(`📊 [${requestId}] Archivo descargado: ${fileBuffer.length} bytes`);
    
    // Subir archivo a Supabase Storage
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseStorage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const fileName = `${provider.name}_${new Date().toISOString().split('T')[0]}_${Date.now()}_${documentData.filename}`;
    const filePath = `providers/${userId}/${provider.id}/${fileName}`;
    
    console.log(`📤 [${requestId}] Subiendo archivo a Storage: ${filePath}`);
    
    const { error: uploadError } = await supabaseStorage.storage
      .from('files')
      .upload(filePath, fileBuffer, {
        contentType: documentData.mimeType,
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Error subiendo archivo: ${uploadError.message}`);
    }
    
    // Obtener URL pública del archivo
    const { data: { publicUrl } } = supabaseStorage.storage
      .from('files')
      .getPublicUrl(filePath);
    
    console.log(`✅ [${requestId}] Archivo subido exitosamente: ${publicUrl}`);
    
    // Crear documento en la base de datos
    const { DocumentService } = await import('../../../../lib/documentService');
    const documentService = new DocumentService();
    
    const documentResult = await documentService.createDocument({
      user_id: userId,
      filename: fileName,
      file_url: publicUrl,
      file_size: fileBuffer.length,
      file_type: 'factura', // Asumir que es una factura por defecto
      mime_type: documentData.mimeType,
      whatsapp_message_id: documentData.id,
      sender_phone: fromNumber,
      sender_type: 'provider',
      provider_id: provider.id
    });
    
    if (!documentResult.success) {
      throw new Error(`Error creando documento: ${documentResult.error}`);
    }
    
    console.log(`✅ [${requestId}] Documento creado en BD: ${documentResult.document_id}`);
    
    // ✅ CORREGIDO: Procesar documento con OCR inmediatamente
    console.log(`🤖 [${requestId}] Iniciando procesamiento OCR inmediato...`);
    
    try {
      console.log(`🔍 [${requestId}] Llamando a documentService.processDocumentWithOCR...`);
      const ocrResult = await documentService.processDocumentWithOCR(documentResult.document_id!);
      
      if (ocrResult.success) {
        const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
        const logger = InvoiceOrderLogger.getInstance();
        await logger.success(requestId, 'OCR completado exitosamente en Kapso', {
          documentId: documentResult.document_id,
          confidence: ocrResult.confidence_score
        });
        console.log(`✅ [${requestId}] OCR completado exitosamente para documento: ${documentResult.document_id}`);
        console.log(`📊 [${requestId}] OCR exitoso, datos procesados`);
        
        // Esperar un momento para asegurar que los datos OCR estén guardados en la BD
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 🔧 NUEVO: Actualizar orden con datos extraídos del OCR
        await logger.info(requestId, 'Llamando a updateOrderWithExtractedData desde Kapso', {
          documentId: documentResult.document_id,
          userId: userId
        });
        await updateOrderWithExtractedData(
          documentResult.document_id!,
          requestId,
          userId,
          supabase
        );
      } else {
        const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
        const logger = InvoiceOrderLogger.getInstance();
        await logger.error(requestId, 'Error en OCR de Kapso', { error: ocrResult.error, documentId: documentResult.document_id });
        console.error(`❌ [${requestId}] Error en OCR: ${ocrResult.error}`);
      }
    } catch (ocrError) {
      console.error(`❌ [${requestId}] Error procesando OCR:`, ocrError);
    }
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error procesando documento con OCR:`, error);
  }
}

// 🔧 NUEVA FUNCIÓN: Crear orden desde factura sin orden existente
async function createOrderFromInvoice(
  document: any,
  requestId: string,
  userId: string,
  supabase: any
): Promise<{ success: boolean; order?: any; error?: string }> {
  try {
    console.log(`🆕 [${requestId}] Iniciando creación de orden desde factura...`);
    
    // Extraer datos de la factura del texto OCR (necesario antes de buscar orden)
    const extractedData = document.ocr_data;
    const invoiceData = extractedData?.invoice_data || {};
    
    // 🔧 CORRECCIÓN: Buscar orden existente en estado "enviado" para este proveedor
    if (document.provider_id) {
      console.log(`🔍 [${requestId}] Buscando orden existente en estado "enviado" para proveedor ${document.provider_id}...`);
      
      const { data: existingOrders, error: searchError } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('user_id', userId)
        .eq('provider_id', document.provider_id)
        .eq('status', 'enviado')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (searchError) {
        console.error(`❌ [${requestId}] Error buscando orden existente:`, searchError);
      }
      
      console.log(`🔍 [${requestId}] DIAGNÓSTICO: Resultado de búsqueda (createOrderFromInvoice):`, {
        found: existingOrders?.length || 0,
        orders: existingOrders?.map(o => ({ id: o.id, order_number: o.order_number, status: o.status })) || [],
        error: searchError?.message
      });
      
      // Si se encuentra una orden en estado "enviado", actualizarla en lugar de crear nueva
      if (existingOrders && existingOrders.length > 0) {
        const existingOrder = existingOrders[0];
        console.log(`✅ [${requestId}] Orden existente encontrada: ${existingOrder.order_number} (${existingOrder.id})`);
        console.log(`🔄 [${requestId}] Actualizando orden existente en lugar de crear nueva...`);
        
        // Actualizar orden existente con datos de la factura
        let invoiceTotal = invoiceData.total_amount || invoiceData.totalAmount || 0;
        
        // Si no hay monto, intentar extraerlo
        if (!invoiceTotal && document.extracted_text) {
          try {
            const { simpleInvoiceExtraction } = await import('../../../../lib/simpleInvoiceExtraction');
            const extractedAmount = simpleInvoiceExtraction.extractTotalAmount(document.extracted_text);
            if (extractedAmount && extractedAmount > 0) {
              invoiceTotal = extractedAmount;
            }
          } catch (e) {
            console.warn(`⚠️ [${requestId}] Error extrayendo monto:`, e);
          }
        }
        
        // 🔧 CORRECCIÓN: Guardar items de la factura en invoice_data.invoice_items (no en items de la orden)
        // Los items de la orden deben mantenerse como están (los originales del usuario)
        if (extractedData && !extractedData.invoice_items) {
          // Extraer items de la factura si existen
          const invoiceItems = invoiceData.items || extractedData.items || [];
          if (invoiceItems.length > 0) {
            extractedData.invoice_items = invoiceItems;
          }
        }
        
        const updateData: any = {
          status: 'pendiente_de_pago',
          invoice_data: extractedData, // 🔧 Los items de la factura están aquí en invoice_data.invoice_items
          invoice_number: invoiceData.invoice_number || invoiceData.invoiceNumber,
          invoice_currency: invoiceData.currency || 'ARS',
          invoice_date: invoiceData.issue_date || invoiceData.issueDate,
          extraction_confidence: document.confidence_score,
          receipt_url: document.file_url,
          updated_at: new Date().toISOString()
        };
        
        if (invoiceTotal && invoiceTotal > 0) {
          updateData.total_amount = invoiceTotal;
          updateData.invoice_total = invoiceTotal;
        }
        
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', existingOrder.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`❌ [${requestId}] Error actualizando orden existente:`, updateError);
        } else {
          // Actualizar documento con order_id
          await supabase
            .from('documents')
            .update({ order_id: existingOrder.id })
            .eq('id', document.id);
          
          // Emitir broadcast
          await supabase
            .channel('orders-updates')
            .send({
              type: 'broadcast' as const,
              event: 'order_updated',
              payload: {
                orderId: existingOrder.id,
                status: 'pendiente_de_pago',
                receiptUrl: document.file_url,
                totalAmount: invoiceTotal,
                timestamp: new Date().toISOString(),
                source: 'invoice_ocr'
              }
            });
          
          console.log(`✅ [${requestId}] Orden existente actualizada exitosamente`);
          return { success: true, order: updatedOrder };
        }
      }
    }
    
    // 🔧 FIX: Buscar extracted_text en múltiples lugares para logging
    const extractedTextSource = document.extracted_text ? 'document.extracted_text' :
                                extractedData?.extractedText ? 'extractedData.extractedText' :
                                extractedData?.extracted_text ? 'extractedData.extracted_text' :
                                invoiceData?.extractedText ? 'invoiceData.extractedText' : 'none';
    
    console.log(`🔍 [${requestId}] Estructura de datos OCR:`, {
      hasOcrData: !!extractedData,
      hasInvoiceData: !!invoiceData,
      invoiceDataKeys: invoiceData ? Object.keys(invoiceData) : [],
      extractedDataKeys: extractedData ? Object.keys(extractedData) : [],
      hasDocumentExtractedText: !!document.extracted_text,
      documentExtractedTextLength: document.extracted_text?.length || 0,
      extractedTextSource: extractedTextSource,
      extractedTextLength: (document.extracted_text || extractedData?.extractedText || extractedData?.extracted_text || invoiceData?.extractedText)?.length || 0,
      documentKeys: document ? Object.keys(document) : []
    });
    
    // 🔧 MEJORA: Extraer monto total usando simpleInvoiceExtraction (patrones más robustos)
    let invoiceTotal = null;
    
    // Primero intentar desde los datos estructurados del OCR
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
    
    // 🔧 MEJORA: Si no se encuentra en los datos estructurados, usar simpleInvoiceExtraction
    // que tiene patrones más robustos y maneja mejor los formatos argentinos
    if (!invoiceTotal && document.extracted_text) {
      console.log(`🔍 [${requestId}] Monto no encontrado en datos estructurados, usando simpleInvoiceExtraction...`);
      try {
        const { simpleInvoiceExtraction } = await import('../../../../lib/simpleInvoiceExtraction');
        const extractedAmount = simpleInvoiceExtraction.extractTotalAmount(document.extracted_text);
        
        if (extractedAmount && extractedAmount > 0) {
          invoiceTotal = extractedAmount;
          console.log(`✅ [${requestId}] Monto extraído con simpleInvoiceExtraction: $${invoiceTotal}`);
        } else {
          console.log(`⚠️ [${requestId}] simpleInvoiceExtraction no encontró monto válido`);
        }
      } catch (extractionError) {
        console.error(`❌ [${requestId}] Error usando simpleInvoiceExtraction:`, extractionError);
        // Fallback al patrón simple anterior
      const amountMatch = document.extracted_text.match(/(?:total|importe|monto)[\s:]*\$?[\s]*([\d,\.]+)/i);
      if (amountMatch) {
          // Intentar parsear mejor el formato argentino
          const amountStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
          invoiceTotal = parseFloat(amountStr) || null;
        }
      }
    }
    
    // 🔧 CORRECCIÓN: Si es una factura, crear la orden aunque no se haya extraído el monto
    // Si no hay monto total pero es una factura, usar 0 como valor por defecto
    if (!invoiceTotal || invoiceTotal <= 0) {
      // Verificar si el documento está identificado como factura
      const isInvoice = document.file_type === 'factura' || 
                       document.file_type === 'invoice' ||
                       (document.extracted_text && /factura|invoice|comprobante/i.test(document.extracted_text));
      
      if (isInvoice) {
        console.log(`⚠️ [${requestId}] No se encontró monto válido en la factura, pero es una factura identificada. Creando orden con monto 0.`);
        invoiceTotal = 0; // Usar 0 como valor por defecto
      } else {
        console.error(`❌ [${requestId}] No se encontró monto válido y el documento no está identificado como factura`);
      return { success: false, error: 'No se encontró monto válido en la factura' };
      }
    }
    
    console.log(`💰 [${requestId}] Monto extraído de la factura: $${invoiceTotal}`);
    
    // Extraer items de la factura
    let items: any[] = [];
    console.log(`📦 [${requestId}] Verificando items en invoice_data:`, {
      hasInvoiceDataItems: !!invoiceData.items,
      invoiceDataItemsLength: invoiceData.items?.length,
      hasExtractedDataItems: !!extractedData.items,
      extractedDataItemsLength: extractedData.items?.length,
      firstInvoiceItem: invoiceData.items?.[0],
      firstExtractedItem: extractedData.items?.[0],
      hasExtractedText: !!document.extracted_text,
      extractedTextLength: document.extracted_text?.length || 0
    });
    
    if (invoiceData.items && Array.isArray(invoiceData.items)) {
      console.log(`✅ [${requestId}] Encontrados items en invoice_data:`, invoiceData.items);
      items = invoiceData.items.map((item: any) => ({
        productName: item.description || item.name || 'Producto sin nombre',
        quantity: item.quantity || 1,
        unit: item.unit || 'un', // Default a 'un' si no se especifica
        price: item.unitPrice || item.priceUnitNet || item.price || 0,
        total: item.total || item.priceTotalNet || (item.unitPrice || item.priceUnitNet || 0) * item.quantity || 0
      }));
    } else if (extractedData.items && Array.isArray(extractedData.items)) {
      console.log(`✅ [${requestId}] Encontrados items en extractedData:`, extractedData.items);
      items = extractedData.items.map((item: any) => ({
        productName: item.description || item.name || 'Producto sin nombre',
        quantity: item.quantity || 1,
        unit: item.unit || 'un', // Default a 'un' si no se especifica
        price: item.unitPrice || item.priceUnitNet || item.price || 0,
        total: item.total || item.priceTotalNet || (item.unitPrice || item.priceUnitNet || 0) * item.quantity || 0
      }));
    }
    
    // Si no hay items extraídos del OCR estructurado, intentar extraer del texto raw
    // 🔧 FIX: Buscar extracted_text en múltiples lugares
    const extractedText = document.extracted_text || 
                         extractedData?.extractedText || 
                         extractedData?.extracted_text ||
                         invoiceData?.extractedText;
    
    console.log(`🔍 [${requestId}] DEBUG extracción multilínea: items.length=${items.length}, hasExtractedText=${!!extractedText}`);
    if (items.length === 0 && extractedText) {
      console.log(`⚠️ [${requestId}] No se encontraron items en OCR estructurado, intentando extracción del texto raw...`);
      
      // 🔧 EXTRACCIÓN ROBUSTA: Múltiples estrategias según formato de factura
      const lines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parseNumber = (s: string): number => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
      const isHeader = (s: string) => /producto.*servicio.*cantidad|u\.\s*medida.*precio\s*unit|codigo.*producto/i.test(s.replace(/\s+/g, ''));
      const isTotalLine = (s: string) => /^importe\s|^total\s|^subtotal|^iva\s|\d+%:.*\$\d|^cae\s*[n°º]|vto\.?\s*de\s*cae|comprobante\s+autorizado|^codigo.*producto.*servicio/i.test(s.toLowerCase());
      
      // Buscar inicio de tabla de items
      let start = lines.findIndex(l => /producto.*servicio|codigo.*producto.*servicio/i.test(l.toLowerCase()));
      if (start < 0) start = 0; else start += 1;
      
      console.log(`🔍 [${requestId}] Iniciando extracción de items desde línea ${start}, total líneas: ${lines.length}`);
      console.log(`🔍 [${requestId}] Primeras 30 líneas del texto:`, lines.slice(start, start + 30));
      
      // ESTRATEGIA 1: Formato de 3 líneas (Producto | Cantidad | Unidad | Precios)
      for (let i = start; i < lines.length - 2; ) {
        const line1 = lines[i];
        const line2 = lines[i + 1] || '';
        const line3 = lines[i + 2] || '';
        
        // Skip headers y líneas de totales
        if (!line1 || isHeader(line1) || isTotalLine(line1)) { i++; continue; }
        
        console.log(`🔍 [${requestId}] Intentando parsear líneas ${i}-${i+2}:`, {
          line1, line2, line3
        });
        
        // Intentar múltiples patrones de extracción
        
        // PATRÓN C: Producto con "x cantidad" (intentamos primero este porque es más específico)
        // Ejemplo: "Producto x 20" | "unidades" | "1000,00 5000,00"
        const xPatternMatch = line1.match(/^(.+?)\s+x\s*(\d+(?:\.\d+)?)\s*$/i);
        if (xPatternMatch && !isTotalLine(line1)) {
          const name = xPatternMatch[1].trim();
          const qty = parseNumber(xPatternMatch[2]);
          // Aceptar cualquier unitLine, incluso si no es una unidad estándar
          const unit = line2.trim().length > 0 ? line2.toLowerCase() : 'un';
          
          const priceMatches = line3.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
          if (priceMatches && priceMatches.length > 0) {
            const priceUnit = parseNumber(priceMatches[0]);
            const total = parseNumber(priceMatches[priceMatches.length - 1]) || (qty * priceUnit);
            
            if (name.length >= 3 && qty > 0) {
              // 🔧 DEDUPLICACIÓN: Verificar si ya existe un item con el mismo nombre y cantidad
              const exists = items.some(item => 
                item.productName === name && item.quantity === qty
              );
              if (!exists) {
                items.push({
                  productName: name,
                  quantity: qty,
                  unit: unit,
                  price: priceUnit,
                  total: total
                });
                console.log(`✅ [${requestId}] Item extraído (Patrón C):`, { name, qty, unit, price: priceUnit, total });
                i += 3;
                continue;
              } else {
                console.log(`⚠️ [${requestId}] Item duplicado detectado y omitido:`, { name, qty });
                i += 3;
                continue;
              }
            }
          }
        }
        
        // PATRÓN A: nameLine con cantidad al final, unitLine, amountsLine
        // Ejemplo: "Producto 5,00" | "unidades" | "1000,00 5000,00"
        // Ajustado para capturar "Producto2,00" o "Producto.2,00" también
        const qtyAtEndMatch = line1.match(/(.+?)[\.]?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$/);
        if (qtyAtEndMatch && line2.toLowerCase().match(/^(un|unidad|unidades|kg|kgs|kg\.|litro|litros|m|metros?|cm|metros?)$/)) {
          const name = qtyAtEndMatch[1].trim();
          const qty = parseNumber(qtyAtEndMatch[2]);
          const unit = line2.toLowerCase();
          
          // Extraer precio de line3 (puede ser "precio1 precio2" o "precio%descripcionprecio")
          const priceMatches = line3.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
          if (priceMatches && priceMatches.length > 0) {
            const priceUnit = parseNumber(priceMatches[0]);
            const total = parseNumber(priceMatches[priceMatches.length - 1]) || (qty * priceUnit);
            
            if (name.length >= 3 && qty > 0) {
              // 🔧 DEDUPLICACIÓN: Verificar si ya existe un item con el mismo nombre y cantidad
              const exists = items.some(item => 
                item.productName === name && item.quantity === qty
              );
              if (!exists) {
                items.push({
                  productName: name,
                  quantity: qty,
                  unit: unit,
                  price: priceUnit,
                  total: total
                });
                console.log(`✅ [${requestId}] Item extraído (Patrón A):`, { name, qty, unit, price: priceUnit, total });
                i += 3;
                continue;
              } else {
                console.log(`⚠️ [${requestId}] Item duplicado detectado y omitido:`, { name, qty });
                i += 3;
                continue;
              }
            }
          }
        }
        
        // PATRÓN B: nombre en line1, cantidad en line2, unidad+precios en line3
        // Ejemplo: "Producto" | "5,00" | "unidades 1000,00 5000,00"
        const qtyOnlyMatch = line2.match(/^(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})$/);
        if (qtyOnlyMatch && !isTotalLine(line1)) {
          const name = line1.trim();
          const qty = parseNumber(qtyOnlyMatch[1]);
          const unitPriceMatches = line3.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
          
          if (unitPriceMatches && unitPriceMatches.length > 0) {
            // Extraer unidad de line3 (antes del primer precio)
            const unitMatch = line3.match(/^([^\d,\.]+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
            const unit = unitMatch ? unitMatch[1].trim().toLowerCase() : 'un';
            const priceUnit = parseNumber(unitPriceMatches[0]);
            const total = parseNumber(unitPriceMatches[unitPriceMatches.length - 1]) || (qty * priceUnit);
            
            if (name.length >= 3 && qty > 0) {
              // 🔧 DEDUPLICACIÓN: Verificar si ya existe un item con el mismo nombre y cantidad
              const exists = items.some(item => 
                item.productName === name && item.quantity === qty
              );
              if (!exists) {
                items.push({
                  productName: name,
                  quantity: qty,
                  unit: unit,
                  price: priceUnit,
                  total: total
                });
                console.log(`✅ [${requestId}] Item extraído (Patrón B):`, { name, qty, unit, price: priceUnit, total });
                i += 3;
                continue;
              } else {
                console.log(`⚠️ [${requestId}] Item duplicado detectado y omitido:`, { name, qty });
                i += 3;
                continue;
              }
            }
          }
        }
        
        // Si ningún patrón funcionó, avanzar
        i++;
      }
      
      console.log(`✅ [${requestId}] Items extraídos del texto raw: ${items.length}`);
    }
    
    // Si aún no hay items, crear un item genérico con el total
    if (items.length === 0) {
      console.log(`⚠️ [${requestId}] No se pudieron extraer items, creando item genérico`);
      items = [{
        productName: 'Factura sin desglose de items',
        quantity: 1,
        unit: 'un',
        price: invoiceTotal || 0,
        total: invoiceTotal || 0
      }];
    }
    
    console.log(`📦 [${requestId}] Items extraídos de la factura:`, items.length);
    console.log(`📋 [${requestId}] Detalle de items extraídos de factura:`, JSON.stringify(items, null, 2));
    
    // Guardar los items de la factura en invoice_data para uso en stock
    if (!extractedData.invoice_items) {
      extractedData.invoice_items = items;
    }
    
    // Generar número de orden único
    const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${randomSuffix}`;
    
    // Crear la orden
    const orderData = {
      id: crypto.randomUUID(),
      user_id: userId,
      provider_id: document.provider_id,
      order_number: orderNumber,
      status: 'pendiente_de_pago', // Estado inicial: pendiente de pago
      total_amount: invoiceTotal,
      currency: invoiceData.currency || 'ARS',
      invoice_data: extractedData, // 🔧 Los items de la factura están aquí en invoice_data.invoice_items
      invoice_number: invoiceData.invoice_number || invoiceData.invoiceNumber,
      invoice_currency: invoiceData.currency || 'ARS',
      invoice_date: invoiceData.issue_date || invoiceData.issueDate,
      extraction_confidence: document.confidence_score,
      receipt_url: document.file_url,
      order_date: invoiceData.issue_date || invoiceData.issueDate || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log(`📝 [${requestId}] Creando orden con datos:`, {
      orderNumber: orderData.order_number,
      provider_id: orderData.provider_id,
      total_amount: orderData.total_amount,
      items_count: items.length
    });
    
    const { data: createdOrder, error: createError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();
    
    if (createError) {
      console.error(`❌ [${requestId}] Error creando orden:`, createError);
      return { success: false, error: createError.message };
    }
    
    console.log(`✅ [${requestId}] Orden creada exitosamente:`, {
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number
    });
    
    // Emitir broadcast para notificar al frontend
    try {
      const broadcastResult = await supabase
        .channel('orders-updates')
        .send({
          type: 'broadcast' as const,
          event: 'order_created',
          payload: {
            orderId: createdOrder.id,
            orderNumber: createdOrder.order_number,
            providerId: createdOrder.provider_id,
            status: createdOrder.status,
            items: items,
            receiptUrl: createdOrder.receipt_url,
            totalAmount: invoiceTotal,
            currency: orderData.currency,
            invoiceNumber: orderData.invoice_number,
            invoiceDate: orderData.invoice_date,
            orderDate: orderData.order_date,
            timestamp: new Date().toISOString(),
            source: 'invoice_auto_create'
          }
        });

      if (broadcastResult === 'error') {
        console.error(`⚠️ [${requestId}] Error enviando broadcast`);
      } else {
        console.log(`✅ [${requestId}] Broadcast de creación enviado`);
      }
    } catch (broadcastErr) {
      console.error(`⚠️ [${requestId}] Error en broadcast:`, broadcastErr);
    }
    
    // 🔧 NUEVO: Actualizar documento con order_id para evitar duplicados
    try {
      const { error: documentUpdateError } = await supabase
        .from('documents')
        .update({ 
          order_id: createdOrder.id,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);
      
      if (documentUpdateError) {
        console.error(`⚠️ [${requestId}] Error actualizando documento con order_id:`, documentUpdateError);
      } else {
        console.log(`✅ [${requestId}] Documento actualizado con order_id: ${createdOrder.id}`);
      }
    } catch (docUpdateErr) {
      console.error(`⚠️ [${requestId}] Error en actualización de documento:`, docUpdateErr);
    }
    
    return { success: true, order: createdOrder };
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error creando orden desde factura:`, error);
    return { success: false, error: 'Error creando orden desde factura' };
  }
}

// 🔧 FUNCIÓN AUXILIAR: Actualizar orden con datos extraídos del OCR
async function updateOrderWithExtractedData(
  documentId: string,
  requestId: string,
  userId: string,
  supabase: any
): Promise<void> {
  const { InvoiceOrderLogger } = await import('../../../../lib/invoiceOrderLogger');
  const logger = InvoiceOrderLogger.getInstance();
  
  try {
    await logger.info(requestId, 'INICIANDO updateOrderWithExtractedData desde Kapso', {
      documentId: documentId,
      userId: userId
    });
    console.log(`🔄 [${requestId}] Actualizando orden con datos extraídos del OCR...`);
    
    // Obtener el documento con datos OCR
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (docError || !document) {
      console.error(`❌ [${requestId}] Error obteniendo documento:`, docError);
      return;
    }
    
    if (!document.ocr_data || !document.extracted_text) {
      console.log(`⚠️ [${requestId}] Documento no tiene datos OCR extraídos aún`);
      return;
    }
    
    console.log(`📊 [${requestId}] Datos OCR encontrados:`, {
      hasOcrData: !!document.ocr_data,
      hasExtractedText: !!document.extracted_text,
      confidence: document.confidence_score,
      orderId: document.order_id
    });
    
    // Extraer datos del documento una sola vez al inicio
    const extractedData = document.ocr_data;
    const invoiceData = extractedData?.invoice_data || {};
    
    // 🔧 CORRECCIÓN: Siempre crear una orden nueva para cada factura
    // Eliminada la restricción del order_id - cada factura siempre crea su propia orden
    await logger.info(requestId, 'Creando nueva orden desde factura (cada factura crea su propia orden)', {
      providerId: document.provider_id,
      documentId: documentId,
      existingOrderId: document.order_id || null
    });
    console.log(`🆕 [${requestId}] Creando nueva orden desde factura recibida (cada factura crea su propia orden)...`);
    if (document.order_id) {
      console.log(`⚠️ [${requestId}] Documento ya tiene order_id (${document.order_id}), pero creando orden nueva de todas formas`);
    }
    
    // Extraer el número de factura del documento actual
      const currentInvoiceNumber = invoiceData.invoice_number || invoiceData.invoiceNumber;
    console.log(`📄 [${requestId}] Número de factura: ${currentInvoiceNumber || 'No disponible'}`);
        
        // 🔧 NUEVO: Crear orden automáticamente desde la factura
        const createResult = await createOrderFromInvoice(
          document,
          requestId,
          userId,
          supabase
        );
        
        if (!createResult.success || !createResult.order) {
          await logger.error(requestId, 'Error creando orden desde factura', {
            error: createResult.error,
            documentId: documentId
          });
          console.error(`❌ [${requestId}] Error creando orden desde factura:`, createResult.error);
          return;
        }
        
    const order = createResult.order;
        await logger.success(requestId, 'Orden creada exitosamente desde factura de Kapso', {
          orderId: order.id,
          orderNumber: order.order_number,
          documentId: documentId
        });
        console.log(`✅ [${requestId}] Orden creada exitosamente desde factura:`, {
          orderId: order.id,
            orderNumber: order.order_number,
      invoiceNumber: currentInvoiceNumber
          });
    
    let invoiceTotal = null;
    
    // Buscar monto total en los datos extraídos
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
    
    // 🔧 MEJORA: Si no se encuentra en los datos estructurados, usar simpleInvoiceExtraction
    // que tiene patrones más robustos y maneja mejor los formatos argentinos
    if (!invoiceTotal && document.extracted_text) {
      console.log(`🔍 [${requestId}] Monto no encontrado en datos estructurados (updateOrder), usando simpleInvoiceExtraction...`);
      try {
        const { simpleInvoiceExtraction } = await import('../../../../lib/simpleInvoiceExtraction');
        const extractedAmount = simpleInvoiceExtraction.extractTotalAmount(document.extracted_text);
        
        if (extractedAmount && extractedAmount > 0) {
          invoiceTotal = extractedAmount;
          console.log(`✅ [${requestId}] Monto extraído con simpleInvoiceExtraction (updateOrder): $${invoiceTotal}`);
        } else {
          console.log(`⚠️ [${requestId}] simpleInvoiceExtraction no encontró monto válido (updateOrder)`);
        }
      } catch (extractionError) {
        console.error(`❌ [${requestId}] Error usando simpleInvoiceExtraction (updateOrder):`, extractionError);
        // Fallback al patrón simple anterior
      const amountMatch = document.extracted_text.match(/(?:total|importe|monto)[\s:]*\$?[\s]*([\d,\.]+)/i);
      if (amountMatch) {
          // Intentar parsear mejor el formato argentino
          const amountStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
          invoiceTotal = parseFloat(amountStr) || null;
        }
      }
    }
    
    console.log(`💰 [${requestId}] Monto extraído de la factura:`, invoiceTotal);
    
    // Actualizar la orden con los datos extraídos
    const updateData: any = {
      updated_at: new Date().toISOString(),
      invoice_data: extractedData,
      invoice_number: invoiceData.invoice_number || invoiceData.invoiceNumber,
      invoice_currency: invoiceData.currency || 'ARS',
      invoice_date: invoiceData.issue_date || invoiceData.issueDate,
      extraction_confidence: document.confidence_score,
      receipt_url: document.file_url
    };
    
    // Solo cambiar el estado si está en enviado
    if (order.status === 'enviado') {
      updateData.status = 'pendiente_de_pago';
    }
    
    // Actualizar monto si se encontró
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
      console.log(`✅ [${requestId}] Orden actualizada exitosamente con datos de factura:`, {
        orderId: order.id,
        orderNumber: order.order_number,
        newStatus: 'pendiente_de_pago',
        newAmount: invoiceTotal || order.total_amount,
        invoiceNumber: updateData.invoice_number,
        invoiceCurrency: updateData.invoice_currency,
        invoiceDate: updateData.invoice_date
      });
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
              status: updateData.status || order.status,
              receiptUrl: updateData.receipt_url,
              totalAmount: invoiceTotal,
              invoiceNumber: updateData.invoice_number,
              invoiceDate: updateData.invoice_date,
              timestamp: new Date().toISOString(),
              source: 'invoice_ocr'
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
    }
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error actualizando orden con datos extraídos:`, error);
  }
}
