require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

async function fixMissingDocuments() {
    console.log('🔄 Recuperando documentos faltantes...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Documentos específicos que sabemos que faltan
        const missingWhatsAppIds = [
            '666828082733457',  // 15:49:13
            '1378158860611485'  // 15:31:48
        ];
        
        console.log(`🔍 Buscando documentos con IDs: ${missingWhatsAppIds.join(', ')}`);
        
        for (const whatsappId of missingWhatsAppIds) {
            console.log(`\n📎 Procesando documento con WhatsApp ID: ${whatsappId}`);
            
            // Buscar el documento
            const { data: document, error: docError } = await supabase
                .from('documents')
                .select('*')
                .eq('whatsapp_message_id', whatsappId)
                .single();
            
            if (docError) {
                console.error(`❌ Error obteniendo documento ${whatsappId}:`, docError);
                continue;
            }
            
            if (!document) {
                console.log(`⚠️ No se encontró documento con ID ${whatsappId}`);
                continue;
            }
            
            console.log(`📄 Documento encontrado: ${document.filename}`);
            console.log(`   Provider ID: ${document.provider_id}`);
            console.log(`   User ID: ${document.user_id}`);
            console.log(`   File URL: ${document.file_url}`);
            
            // Obtener el número de teléfono del proveedor
            let providerPhone = document.provider_phone;
            
            if (!providerPhone && document.provider_id) {
                console.log(`🔍 Obteniendo teléfono del proveedor...`);
                const { data: provider, error: providerError } = await supabase
                    .from('providers')
                    .select('phone')
                    .eq('id', document.provider_id)
                    .single();
                
                if (providerError) {
                    console.error(`❌ Error obteniendo proveedor:`, providerError);
                    continue;
                }
                
                if (provider) {
                    providerPhone = provider.phone;
                    console.log(`📞 Teléfono del proveedor: ${providerPhone}`);
                }
            }
            
            if (!providerPhone) {
                console.error(`❌ No se pudo obtener el teléfono del proveedor`);
                continue;
            }
            
            // Verificar si ya tiene mensaje
            const { data: existingMessage, error: msgError } = await supabase
                .from('whatsapp_messages')
                .select('id')
                .eq('message_sid', whatsappId)
                .single();
            
            if (msgError && msgError.code !== 'PGRST116') {
                console.error(`❌ Error verificando mensaje:`, msgError);
                continue;
            }
            
            if (existingMessage) {
                console.log(`✅ Ya tiene mensaje: ${existingMessage.id}`);
                continue;
            }
            
            // Crear el mensaje
            console.log(`🔄 Creando mensaje para documento...`);
            
            const messageId = uuidv4();
            const messageData = {
                id: messageId,
                content: `📎 ${document.filename}`,
                message_type: 'received',
                status: 'delivered',
                contact_id: providerPhone,
                user_id: document.user_id,
                message_sid: whatsappId,
                timestamp: document.created_at,
                created_at: document.created_at,
                media_url: document.file_url,
                media_type: document.file_type
            };
            
            console.log(`📝 Datos del mensaje:`, {
                id: messageId,
                content: messageData.content,
                contact_id: messageData.contact_id,
                user_id: messageData.user_id,
                media_url: messageData.media_url
            });
            
            const { error: insertError } = await supabase
                .from('whatsapp_messages')
                .insert([messageData]);
            
            if (insertError) {
                console.error(`❌ Error insertando mensaje:`, insertError);
            } else {
                console.log(`✅ Mensaje creado exitosamente: ${messageId}`);
            }
        }
        
        console.log(`\n🎉 Proceso completado`);
        
    } catch (error) {
        console.error('❌ Error en proceso:', error);
    }
}

fixMissingDocuments();
