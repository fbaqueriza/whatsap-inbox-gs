require('dotenv').config();

async function testWebhookRealDocument() {
    console.log('🧪 Probando webhook con documento real...');
    
    const webhookUrl = 'http://localhost:3001/api/whatsapp/webhook';
    
    // Payload simulado de WhatsApp con documento real
    const payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "670680919470999",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "5491135562673",
                                "phone_number_id": "670680919470999"
                            },
                            "messages": [
                                {
                                    "from": "5491135562673",
                                    "id": `test_real_doc_${Date.now()}`,
                                    "timestamp": Math.floor(Date.now() / 1000).toString(),
                                    "type": "document",
                                    "document": {
                                        "caption": "Documento de prueba",
                                        "filename": `test_real_document_${Date.now()}.pdf`,
                                        "sha256": "test_hash",
                                        "mime_type": "application/pdf",
                                        "id": `test_media_${Date.now()}`
                                    },
                                    "context": {
                                        "from": "5491135562673",
                                        "id": "test_context_id"
                                    }
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    };
    
    try {
        console.log('📤 Enviando payload al webhook...');
        console.log('📋 Datos del documento:', {
            from: payload.entry[0].changes[0].value.messages[0].from,
            id: payload.entry[0].changes[0].value.messages[0].id,
            filename: payload.entry[0].changes[0].value.messages[0].document.filename,
            media_id: payload.entry[0].changes[0].value.messages[0].document.id
        });
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Hub-Signature-256': 'sha256=test_signature'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.text();
        console.log(`📊 Respuesta del webhook: ${response.status} ${response.statusText}`);
        console.log('📄 Contenido de la respuesta:', result);
        
        if (response.ok) {
            console.log('✅ Webhook respondió correctamente');
            console.log('⏳ Esperando 3 segundos para que se procese...');
            
            // Esperar un poco para que se procese
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verificar si se creó el documento
            console.log('🔍 Verificando si se creó el documento...');
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            
            const { data: documents, error } = await supabase
                .from('documents')
                .select('*')
                .ilike('filename', `test_real_document_${payload.entry[0].changes[0].value.messages[0].document.filename.split('_').pop()}`)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) {
                console.error('❌ Error verificando documento:', error);
            } else if (documents && documents.length > 0) {
                const doc = documents[0];
                console.log('✅ Documento encontrado:', {
                    id: doc.id,
                    filename: doc.filename,
                    whatsapp_message_id: doc.whatsapp_message_id,
                    provider_phone: doc.provider_phone,
                    created_at: doc.created_at
                });
                
                // Verificar si tiene mensaje en chat
                const { data: message, error: msgError } = await supabase
                    .from('whatsapp_messages')
                    .select('*')
                    .eq('message_sid', doc.whatsapp_message_id)
                    .single();
                
                if (msgError && msgError.code !== 'PGRST116') {
                    console.error('❌ Error verificando mensaje:', msgError);
                } else if (message) {
                    console.log('✅ Mensaje encontrado en chat:', {
                        id: message.id,
                        content: message.content,
                        contact_id: message.contact_id,
                        media_url: message.media_url
                    });
                    console.log('🎉 ¡PRUEBA EXITOSA! El documento apareció en el chat automáticamente');
                } else {
                    console.log('❌ No se encontró mensaje en chat para este documento');
                    console.log('🔧 Esto indica que el webhook falló al crear el mensaje');
                }
            } else {
                console.log('❌ No se encontró documento creado');
            }
        } else {
            console.log('❌ Webhook respondió con error');
        }
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error);
    }
}

testWebhookRealDocument();
