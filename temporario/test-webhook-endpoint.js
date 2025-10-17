// Script para probar el endpoint del webhook directamente
const https = require('https');

async function testWebhookEndpoint() {
  console.log('🔍 PROBANDO ENDPOINT DEL WEBHOOK');
  console.log('==================================');
  console.log('⏰ Timestamp:', new Date().toISOString());

  const webhookUrl = 'https://8f3d23bd8a87.ngrok-free.app/api/whatsapp/webhook';
  
  // Simular el webhook de Kapso que me pasaste
  const webhookPayload = {
    "entry": [
      {
        "id": "1123051623072203",
        "changes": [
          {
            "field": "messages",
            "value": {
              "contacts": [
                {
                  "wa_id": "5491135562673",
                  "profile": {
                    "name": "Francisco Baqueriza"
                  }
                }
              ],
              "messages": [
                {
                  "id": "wamid.HBgNNTQ5MTEzNTU2MjY3MxUCABIYIEFDNTUxOUYyMUVBNURGQjZBMjc1RTdFNDE4NUY5OEEyAA==",
                  "from": "5491135562673",
                  "type": "document",
                  "context": {
                    "forwarded": true
                  },
                  "document": {
                    "id": "1147646833434412",
                    "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1147646833434412&source=webhook&ext=1760540696&hash=ARkxvwHG_lKMNbShyzm05rSj-3Ud4pSiABf8Q-VTJfuSsQ",
                    "sha256": "5Dmw3vN5/snRhhYswSzSP6fpidRRYgJfB1DIN5EWOzA=",
                    "filename": "20143089984_001_00004_00000508.pdf",
                    "mime_type": "application/pdf"
                  },
                  "timestamp": "1760540395"
                }
              ],
              "metadata": {
                "phone_number_id": "670680919470999",
                "display_phone_number": "5491141780300"
              },
              "messaging_product": "whatsapp"
            }
          }
        ]
      }
    ],
    "object": "whatsapp_business_account"
  };

  console.log('\n📤 Enviando webhook de prueba a:', webhookUrl);
  console.log('📦 Payload:', JSON.stringify(webhookPayload, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('\n📥 Respuesta del servidor:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('   Body:', responseText);

    if (response.ok) {
      console.log('\n✅ Webhook enviado exitosamente');
    } else {
      console.log('\n❌ Error en el webhook');
    }

  } catch (error) {
    console.error('\n❌ Error enviando webhook:', error.message);
  }
}

testWebhookEndpoint();
