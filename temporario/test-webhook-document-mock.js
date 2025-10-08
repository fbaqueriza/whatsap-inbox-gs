require('dotenv').config();

async function testWebhookDocumentMock() {
    console.log('🧪 Probando webhook con documento simulado...');
    
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/whatsapp/webhook`;
    
    // Crear un documento simulado con un ID que no existe en WhatsApp
    const mockDocument = {
        object: 'whatsapp_business_account',
        entry: [{
            changes: [{
                value: {
                    messages: [{
                        from: '+5491135562673',
                        id: 'mock_document_' + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        type: 'document',
                        document: {
                            id: 'mock_doc_' + Date.now(),
                            filename: 'documento_simulado.pdf',
                            mime_type: 'application/pdf',
                            sha256: 'mock_hash_' + Date.now()
                        }
                    }]
                }
            }]
        }]
    };
    
    console.log('📄 Documento simulado:', JSON.stringify(mockDocument, null, 2));
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(mockDocument)
        });
        
        console.log('📡 Respuesta del webhook:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.text();
            console.log('✅ Webhook respondió correctamente');
            console.log('📝 Respuesta:', result);
        } else {
            console.error('❌ Error en webhook:', response.status, response.statusText);
            const error = await response.text();
            console.error('📝 Error:', error);
        }
        
    } catch (error) {
        console.error('❌ Error enviando request:', error.message);
    }
}

testWebhookDocumentMock();
