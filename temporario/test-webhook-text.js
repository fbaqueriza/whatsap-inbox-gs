// Script para probar el webhook con un mensaje de texto
async function testWebhookText() {
    console.log('🧪 Probando webhook con mensaje de texto...\n');

    try {
        // Simular un webhook de WhatsApp con mensaje de texto
        const mockWebhookPayload = {
            object: 'whatsapp_business_account',
            entry: [{
                changes: [{
                    value: {
                        messages: [{
                            from: '5491135562673',
                            id: 'test_text_' + Date.now(),
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: 'text',
                            text: {
                                body: 'Mensaje de prueba desde webhook'
                            }
                        }]
                    }
                }]
            }]
        };

        console.log('📤 Enviando webhook simulado con texto...');

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
            console.log('✅ Webhook respondió correctamente para mensaje de texto');
        } else {
            console.log('❌ Webhook falló para mensaje de texto');
        }

    } catch (error) {
        console.error('❌ Error probando webhook:', error);
    }
}

testWebhookText();
