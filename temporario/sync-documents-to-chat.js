// Script para sincronizar documentos existentes con el chat
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan credenciales de Supabase en el .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncDocumentsToChat() {
    console.log('🔄 Sincronizando documentos con el chat...\n');

    try {
        // 1. Obtener documentos que no tienen mensaje correspondiente
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
            .is('whatsapp_message_id', null) // Solo documentos sin mensaje
            .order('created_at', { ascending: false });

        if (docsError) {
            console.error('❌ Error obteniendo documentos:', docsError);
            return;
        }

        if (!documents || documents.length === 0) {
            console.log('✅ No hay documentos sin sincronizar');
            return;
        }

        console.log(`📎 Encontrados ${documents.length} documentos para sincronizar`);

        // 2. Crear mensajes para cada documento
        let syncedCount = 0;
        const errors = [];

        for (const doc of documents) {
            try {
                console.log(`\n📄 Procesando: ${doc.filename}`);

                // Crear mensaje en whatsapp_messages
                const messageData = {
                    id: `doc_${doc.id}_${Date.now()}`,
                    content: `📎 ${doc.filename}`,
                    message_type: 'received',
                    status: 'delivered',
                    contact_id: doc.providers.phone,
                    user_id: doc.user_id,
                    message_sid: `doc_${doc.id}`,
                    timestamp: doc.created_at,
                    created_at: doc.created_at,
                    media_url: doc.file_url,
                    media_type: doc.mime_type
                };

                console.log(`   📱 Creando mensaje para contacto: ${doc.providers.phone}`);

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

                // 3. Actualizar documento con el ID del mensaje creado
                const { error: updateError } = await supabase
                    .from('documents')
                    .update({ whatsapp_message_id: insertedMessage.id })
                    .eq('id', doc.id);

                if (updateError) {
                    console.error(`   ❌ Error actualizando documento:`, updateError);
                    errors.push({ document: doc.filename, error: updateError.message });
                    continue;
                }

                console.log(`   ✅ Sincronizado: ${doc.filename}`);
                syncedCount++;

            } catch (error) {
                console.error(`   ❌ Error procesando ${doc.filename}:`, error);
                errors.push({ document: doc.filename, error: error.message });
            }
        }

        // 4. Resumen
        console.log(`\n📊 RESUMEN:`);
        console.log(`✅ Documentos sincronizados: ${syncedCount}`);
        console.log(`❌ Errores: ${errors.length}`);

        if (errors.length > 0) {
            console.log(`\n❌ ERRORES:`);
            errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.document}: ${error.error}`);
            });
        }

        // 5. Verificar resultado
        console.log(`\n🔍 Verificando resultado...`);
        const { data: messagesWithDocs } = await supabase
            .from('whatsapp_messages')
            .select('id, content, media_url, media_type, created_at, contact_id')
            .not('media_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (messagesWithDocs && messagesWithDocs.length > 0) {
            console.log(`✅ Mensajes con documentos en chat: ${messagesWithDocs.length}`);
            messagesWithDocs.forEach((msg, index) => {
                console.log(`   ${index + 1}. ${msg.content} (${msg.media_type}) - ${msg.contact_id}`);
            });
        } else {
            console.log('❌ Aún no hay mensajes con documentos en el chat');
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

syncDocumentsToChat();
