// Script para probar el webhook de Kapso localmente
const https = require('https');
const http = require('http');

const testWebhook = () => {
  const testData = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1123051623072203',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5491141780300',
                phone_number_id: '670680919470999'
              },
              messages: [
                {
                  from: '5491135562673',
                  id: 'wamid.test_message_' + Date.now(),
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: {
                    body: 'Mensaje de prueba desde el script'
                  }
                }
              ],
              contacts: [
                {
                  profile: {
                    name: 'Proveedor Test'
                  },
                  wa_id: '5491135562673'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ],
    controller: 'api/webhooks/whatsapp',
    action: 'receive',
    whatsapp: {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1123051623072203',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '5491141780300',
                  phone_number_id: '670680919470999'
                },
                messages: [
                  {
                    from: '5491135562673',
                    id: 'wamid.test_message_' + Date.now(),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: {
                      body: 'Mensaje de prueba desde el script'
                    }
                  }
                ],
                contacts: [
                  {
                    profile: {
                      name: 'Proveedor Test'
                    },
                    wa_id: '5491135562673'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    }
  };

  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/kapso/supabase-events',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'x-kapso-signature': '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb'
    }
  };

  console.log('🧪 Enviando test webhook a:', `http://${options.hostname}:${options.port}${options.path}`);
  console.log('📤 Datos enviados:', JSON.stringify(testData, null, 2));

  const req = http.request(options, (res) => {
    console.log(`📥 Respuesta recibida: ${res.statusCode}`);
    console.log(`📋 Headers de respuesta:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📄 Respuesta completa:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Error en la petición: ${e.message}`);
  });

  req.write(postData);
  req.end();
};

// Ejecutar el test
testWebhook();
