// Script para probar el webhook con un documento simulado
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testWebhookDocuments() {
    console.log('🧪 Probando webhook con documento simulado...\n');

    try {
        // Simular un webhook de WhatsApp con documento
        const mockWebhookPayload = {
            object: 'whatsapp_business_account',
            entry: [{
                changes: [{
                    value: {
                        messages: [{
                            from: '5491135562673',
                            id: 'test_document_' + Date.now(),
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: 'document',
                            document: {
                                id: 'test_doc_id_' + Date.now(),
                                filename: 'test_document.pdf',
                                mime_type: 'application/pdf',
                                sha256: 'test_hash'
                            }
                        }]
                    }
                }]
            }]
        };

        console.log('📤 Enviando webhook simulado...');
        console.log('📋 Payload:', JSON.stringify(mockWebhookPayload, null, 2));

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
            console.log('⏳ Esperando 3 segundos...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verificar si se creó el documento
            const { data: documents } = await supabase
                .from('documents')
                .select('id, filename, whatsapp_message_id')
                .eq('filename', 'test_document.pdf')
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (documents && documents.length > 0) {
                console.log('✅ Documento creado en la base de datos:', documents[0]);
                
                // Verificar si se creó el mensaje
                const { data: messages } = await supabase
                    .from('whatsapp_messages')
                    .select('id, content, media_url')
                    .eq('content', '📎 test_document.pdf')
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

testWebhookDocuments();
