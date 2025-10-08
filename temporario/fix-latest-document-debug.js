require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

async function fixLatestDocumentDebug() {
    console.log('🔄 Recuperando documento más reciente con debug...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Obtener el documento más reciente
        const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (docsError) {
            console.error('❌ Error obteniendo documentos:', docsError);
            return;
        }
        
        if (!documents || documents.length === 0) {
            console.log('ℹ️ No hay documentos para procesar');
            return;
        }
        
        const document = documents[0];
        console.log(`📄 Documento más reciente: ${document.filename}`);
        console.log(`   WhatsApp Message ID: ${document.whatsapp_message_id}`);
        console.log(`   Creado: ${document.created_at}`);
        console.log(`   Provider ID: ${document.provider_id}`);
        console.log(`   Provider Phone: ${document.provider_phone}`);
        
        // Verificar si ya tiene mensaje
        const { data: existingMessage, error: msgError } = await supabase
            .from('whatsapp_messages')
            .select('id, created_at')
            .eq('message_sid', document.whatsapp_message_id)
            .single();
        
        if (msgError && msgError.code !== 'PGRST116') {
            console.error(`❌ Error verificando mensaje:`, msgError);
            return;
        }
        
        if (existingMessage) {
            console.log(`✅ Ya tiene mensaje: ${existingMessage.id} (${existingMessage.created_at})`);
            return;
        }
        
        console.log(`❌ NO TIENE MENSAJE EN CHAT - Sincronizando...`);
        
        // Obtener el número de teléfono del proveedor
        let providerPhone = document.sender_phone;
        
        if (!providerPhone && document.provider_id) {
            console.log(`🔍 Obteniendo teléfono del proveedor...`);
            const { data: provider, error: providerError } = await supabase
                .from('providers')
                .select('phone')
                .eq('id', document.provider_id)
                .single();
            
            if (providerError) {
                console.error(`❌ Error obteniendo proveedor:`, providerError);
                return;
            }
            
            if (provider) {
                providerPhone = provider.phone;
                console.log(`📞 Teléfono del proveedor: ${providerPhone}`);
            }
        }
        
        if (!providerPhone) {
            console.error(`❌ No se pudo obtener el teléfono del proveedor`);
            return;
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
            message_sid: document.whatsapp_message_id,
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
            message_sid: messageData.message_sid,
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
        
        // Análisis del problema
        console.log(`\n🔍 ANÁLISIS DEL PROBLEMA:`);
        console.log(`   📄 Documento creado: ${document.created_at}`);
        console.log(`   📱 Sender Phone en documento: ${document.sender_phone}`);
        console.log(`   📞 Provider Phone real: ${providerPhone}`);
        console.log(`   🔍 Diferencia: ${document.sender_phone === providerPhone ? 'Iguales' : 'Diferentes'}`);
        
        if (document.sender_phone !== providerPhone) {
            console.log(`   🚨 PROBLEMA: sender_phone en documento no coincide con provider.phone`);
        }
        
    } catch (error) {
        console.error('❌ Error en proceso:', error);
    }
}

fixLatestDocumentDebug();
