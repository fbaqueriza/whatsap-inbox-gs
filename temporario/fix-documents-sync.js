// Script para sincronizar documentos existentes creando mensajes en whatsapp_messages
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixDocumentsSync() {
    console.log('🔧 Sincronizando documentos existentes con el chat...\n');

    try {
        // 1. Obtener documentos que tienen whatsapp_message_id pero no tienen mensaje correspondiente
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select(`
                id,
                filename,
                file_url,
                file_type,
                mime_type,
                created_at,
                sender_phone,
                provider_id,
                user_id,
                whatsapp_message_id,
                providers!inner(
                    id,
                    name,
                    phone
                )
            `)
            .not('whatsapp_message_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10); // Empezar con los 10 más recientes

        if (docsError) {
            console.error('❌ Error obteniendo documentos:', docsError);
            return;
        }

        if (!documents || documents.length === 0) {
            console.log('✅ No hay documentos para sincronizar');
            return;
        }

        console.log(`📎 Encontrados ${documents.length} documentos para sincronizar`);

        // 2. Verificar cuáles documentos ya tienen mensajes en whatsapp_messages
        const messageIds = documents.map(doc => doc.whatsapp_message_id);
        const { data: existingMessages } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .in('id', messageIds);

        const existingMessageIds = existingMessages ? existingMessages.map(msg => msg.id) : [];
        console.log(`📱 Mensajes existentes: ${existingMessageIds.length}`);

        // 3. Filtrar documentos que NO tienen mensaje correspondiente
        const documentsToSync = documents.filter(doc => !existingMessageIds.includes(doc.whatsapp_message_id));
        console.log(`🔄 Documentos a sincronizar: ${documentsToSync.length}`);

        if (documentsToSync.length === 0) {
            console.log('✅ Todos los documentos ya están sincronizados');
            return;
        }

        // 4. Crear mensajes para cada documento
        let syncedCount = 0;
        const errors = [];

        for (const doc of documentsToSync) {
            try {
                console.log(`\n📄 Procesando: ${doc.filename}`);

                // Crear mensaje en whatsapp_messages con UUID válido
                const messageId = uuidv4();
                const messageData = {
                    id: messageId, // Generar UUID válido
                    content: `📎 ${doc.filename}`,
                    message_type: 'received',
                    status: 'delivered',
                    contact_id: doc.providers.phone,
                    user_id: doc.user_id,
                    message_sid: doc.whatsapp_message_id, // Guardar el ID original de WhatsApp aquí
                    timestamp: doc.created_at,
                    created_at: doc.created_at,
                    media_url: doc.file_url,
                    media_type: doc.mime_type
                };

                console.log(`   📱 Creando mensaje con UUID: ${messageId}`);
                console.log(`   📱 WhatsApp ID original: ${doc.whatsapp_message_id}`);

                const { data: insertedMessage, error: insertError } = await supabase
                    .from('whatsapp_messages')
                    .insert([messageData])
                    .select('id')
                    .single();

                if (insertError) {
                    console.error(`   ❌ Error insertando mensaje:`, insertError);
                    errors.push({ document: doc.filename, error: insertError.message });
                    continue;
                }

                console.log(`   ✅ Mensaje creado: ${insertedMessage.id}`);
                syncedCount++;

            } catch (error) {
                console.error(`   ❌ Error procesando ${doc.filename}:`, error);
                errors.push({ document: doc.filename, error: error.message });
            }
        }

        // 5. Resumen
        console.log(`\n📊 RESUMEN:`);
        console.log(`✅ Documentos sincronizados: ${syncedCount}`);
        console.log(`❌ Errores: ${errors.length}`);

        if (errors.length > 0) {
            console.log(`\n❌ ERRORES:`);
            errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.document}: ${error.error}`);
            });
        }

        // 6. Verificar resultado final
        console.log(`\n🔍 Verificando resultado final...`);
        const { data: finalMessagesWithDocs } = await supabase
            .from('whatsapp_messages')
            .select('id, content, media_url, media_type, created_at, contact_id')
            .not('media_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (finalMessagesWithDocs && finalMessagesWithDocs.length > 0) {
            console.log(`✅ Mensajes con documentos en chat: ${finalMessagesWithDocs.length}`);
            finalMessagesWithDocs.forEach((msg, index) => {
                console.log(`   ${index + 1}. ${msg.content} (${msg.media_type}) - ${msg.contact_id}`);
                console.log(`      URL: ${msg.media_url}`);
            });
        } else {
            console.log('❌ Aún no hay mensajes con documentos en el chat');
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

fixDocumentsSync();
