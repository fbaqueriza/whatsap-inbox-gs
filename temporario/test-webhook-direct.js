// Probar webhook directamente
const https = require('https');
require('dotenv').config();

// Obtener la URL de ngrok del .env o usar una por defecto
const ngrokUrl = 'https://f7e3caa406f.ngrok.io';
const webhookUrl = `${ngrokUrl}/api/whatsapp/webhook`;

console.log('🧪 Probando webhook directamente...');
console.log(`📍 URL del webhook: ${webhookUrl}`);

// Simular un mensaje del proveedor
const testMessage = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "ENTRY_ID",
      changes: [
        {
          field: "messages",
          value: {
            messages: [
              {
                from: "+5491135562673",
                timestamp: Math.floor(Date.now() / 1000),
                type: "text",
                id: "wamid.TEST_MESSAGE_ID",
                text: {
                  body: "Hola, este es un mensaje de prueba"
                }
              }
            ],
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "PHONE_NUMBER_ID"
            }
          }
        }
      ]
    }
  ]
};

const postData = JSON.stringify(testMessage);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📤 Enviando mensaje de prueba...');
console.log('📝 Mensaje:', JSON.stringify(testMessage, null, 2));

const req = https.request(webhookUrl, options, (res) => {
  console.log(`✅ Respuesta del servidor: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📄 Respuesta completa:', data);
    if (res.statusCode === 200) {
      console.log('✅ Webhook funcionando correctamente');
    } else {
      console.log('❌ Webhook no está funcionando');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error al probar webhook:', error.message);
  console.log('💡 Verifica que:');
  console.log('   - El servidor esté corriendo en puerto 3001');
  console.log('   - ngrok esté corriendo y la URL sea correcta');
  console.log('   - La URL en el .env sea la correcta');
});

req.write(postData);
req.end();
