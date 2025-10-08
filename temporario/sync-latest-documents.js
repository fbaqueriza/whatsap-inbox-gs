require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

async function syncLatestDocuments() {
    console.log('🔄 Sincronizando documentos más recientes...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Obtener los 5 documentos más recientes
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (docsError) {
            console.error('❌ Error obteniendo documentos:', docsError);
            return;
        }
        
        if (!documents || documents.length === 0) {
            console.log('ℹ️ No hay documentos para sincronizar');
            return;
        }
        
        console.log(`📄 Documentos encontrados: ${documents.length}`);
        
        for (const doc of documents) {
            console.log(`\n📎 Procesando: ${doc.filename}`);
            console.log(`   WhatsApp ID: ${doc.whatsapp_message_id}`);
            console.log(`   Creado: ${doc.created_at}`);
            
            // Verificar si ya existe un mensaje para este documento
            const { data: existingMessage, error: checkError } = await supabase
                .from('whatsapp_messages')
                .select('id')
                .eq('message_sid', doc.whatsapp_message_id)
                .single();
            
            if (checkError && checkError.code !== 'PGRST116') {
                console.error(`❌ Error verificando mensaje existente:`, checkError);
                continue;
            }
            
            if (existingMessage) {
                console.log(`   ✅ Ya existe mensaje: ${existingMessage.id}`);
                continue;
            }
            
            // Crear mensaje para el documento
            const messageId = uuidv4();
            const messageData = {
                id: messageId,
                content: `📎 ${doc.filename}`,
                message_type: 'received',
                status: 'delivered',
                contact_id: doc.sender_phone,
                user_id: doc.user_id,
                message_sid: doc.whatsapp_message_id,
                timestamp: doc.created_at,
                created_at: doc.created_at,
                media_url: doc.file_url,
                media_type: doc.file_type
            };
            
            console.log(`   📱 Creando mensaje con ID: ${messageId}`);
            
            const { error: insertError } = await supabase
                .from('whatsapp_messages')
                .insert([messageData]);
            
            if (insertError) {
                console.error(`   ❌ Error creando mensaje:`, insertError);
            } else {
                console.log(`   ✅ Mensaje creado exitosamente`);
            }
        }
        
        console.log('\n🎉 Sincronización completada');
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
    }
}

syncLatestDocuments();