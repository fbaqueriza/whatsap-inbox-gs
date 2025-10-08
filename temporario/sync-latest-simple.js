require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

async function syncLatestDocument() {
    console.log('🔄 Sincronizando documento más reciente...');
    
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // Obtener el documento más reciente
        const { data: documents, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error || !documents || documents.length === 0) {
            console.log('❌ No hay documentos para sincronizar');
            return;
        }
        
        const document = documents[0];
        console.log(`📄 Documento: ${document.filename}`);
        
        // Verificar si ya tiene mensaje
        const { data: existingMessage } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('message_sid', document.whatsapp_message_id)
            .single();
        
        if (existingMessage) {
            console.log('✅ Ya tiene mensaje en chat');
            return;
        }
        
        // Obtener teléfono del proveedor
        let providerPhone = document.sender_phone;
        if (!providerPhone && document.provider_id) {
            const { data: provider } = await supabase
                .from('providers')
                .select('phone')
                .eq('id', document.provider_id)
                .single();
            if (provider) {
                providerPhone = provider.phone;
            }
        }
        
        if (!providerPhone) {
            console.log('❌ No se pudo obtener teléfono del proveedor');
            return;
        }
        
        // Crear mensaje
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
        
        const { error: insertError } = await supabase
            .from('whatsapp_messages')
            .insert([messageData]);
        
        if (insertError) {
            console.error('❌ Error insertando mensaje:', insertError);
        } else {
            console.log('✅ Mensaje creado exitosamente en el chat');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

syncLatestDocument();
