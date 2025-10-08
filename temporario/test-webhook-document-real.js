// Script para probar el webhook con un documento usando el formato real de WhatsApp
async function testWebhookDocumentReal() {
    console.log('🧪 Probando webhook con documento usando formato real...\n');

    try {
        // Simular un webhook de WhatsApp con documento usando el formato exacto
        const mockWebhookPayload = {
            object: 'whatsapp_business_account',
            entry: [{
                changes: [{
                    value: {
                        messages: [{
                            from: '+5491135562673', // Usar el formato exacto del proveedor
                            id: 'test_document_real_' + Date.now(),
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: 'document',
                            document: {
                                id: 'test_doc_real_' + Date.now(),
                                filename: 'test_document_real.pdf',
                                mime_type: 'application/pdf',
                                sha256: 'test_hash_real'
                            }
                        }]
                    }
                }]
            }]
        };

        console.log('📤 Enviando webhook con formato real...');
        console.log('📋 From:', mockWebhookPayload.entry[0].changes[0].value.messages[0].from);

        const response = await fetch('http://localhost:3001/api/whatsapp/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockWebhookPayload)
        });

        const responseText = await response.text();
        console.log(`📥 Respuesta del webhook: ${response.status}`);
        console.log('📄 Contenido:', responseText);

        if (response.ok) {
            console.log('✅ Webhook respondió correctamente');
            
            // Esperar un poco y verificar si se creó el documento
            console.log('⏳ Esperando 5 segundos...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verificar si se creó el documento
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            
            const { data: documents } = await supabase
                .from('documents')
                .select('id, filename, whatsapp_message_id, sender_phone')
                .eq('filename', 'test_document_real.pdf')
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (documents && documents.length > 0) {
                console.log('✅ Documento creado en la base de datos:', documents[0]);
                
                // Verificar si se creó el mensaje
                const { data: messages } = await supabase
                    .from('whatsapp_messages')
                    .select('id, content, media_url, contact_id')
                    .eq('content', '📎 test_document_real.pdf')
                    .limit(1);
                
                if (messages && messages.length > 0) {
                    console.log('✅ Mensaje creado en el chat:', messages[0]);
                } else {
                    console.log('❌ No se creó mensaje en el chat');
                }
            } else {
                console.log('❌ No se creó documento en la base de datos');
            }
        } else {
            console.log('❌ Webhook falló');
        }

    } catch (error) {
        console.error('❌ Error probando webhook:', error);
    }
}

testWebhookDocumentReal();
