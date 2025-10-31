// Script para simular exactamente lo que hace el frontend
const http = require('http');

function simulateFrontend() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/debug/frontend-simulation',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📊 Status:', res.statusCode);
      
      try {
        const jsonData = JSON.parse(data);
        console.log('📊 Response:', JSON.stringify(jsonData, null, 2));
        
        if (jsonData.success) {
          console.log('\n✅ Simulación del frontend exitosa!');
          
          // Simular exactamente lo que hace ChatContext
          const conversations = jsonData.conversations || [];
          console.log('📞 Conversaciones recibidas:', conversations.length);
          
          if (conversations.length === 0) {
            console.log('❌ No hay conversaciones - el chat estará vacío');
            return;
          }
          
          console.log('📋 Detalles de conversaciones:');
          conversations.forEach((conv, index) => {
            console.log(`  ${index + 1}. ID: ${conv.id}`);
            console.log(`     Phone: ${conv.phone_number}`);
            console.log(`     Contact: ${conv.contact_name}`);
            console.log(`     Status: ${conv.status}`);
            console.log(`     Last Active: ${conv.last_active_at}`);
            console.log(`     Config ID: ${conv.whatsapp_config_id}`);
            console.log('');
          });
          
          // Simular el procesamiento de mensajes
          console.log('🔄 Simulando carga de mensajes para cada conversación...');
          
          conversations.forEach(async (conv, index) => {
            console.log(`📱 Procesando conversación ${index + 1}: ${conv.phone_number}`);
            
            // Simular llamada a /api/kapso/chat?action=messages&phoneNumber=...
            const messagesOptions = {
              hostname: 'localhost',
              port: 3001,
              path: `/api/kapso/chat?action=messages&phoneNumber=${encodeURIComponent(conv.phone_number)}`,
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY
              }
            };
            
            const messagesReq = http.request(messagesOptions, (messagesRes) => {
              let messagesData = '';
              
              messagesRes.on('data', (chunk) => {
                messagesData += chunk;
              });
              
              messagesRes.on('end', () => {
                try {
                  const messagesJson = JSON.parse(messagesData);
                  console.log(`  📨 Mensajes para ${conv.phone_number}:`, messagesJson.messages?.length || 0);
                  
                  if (messagesJson.messages && messagesJson.messages.length > 0) {
                    console.log(`  ✅ ${messagesJson.messages.length} mensajes encontrados`);
                    messagesJson.messages.forEach((msg, msgIndex) => {
                      console.log(`    ${msgIndex + 1}. ${msg.content} (${msg.direction})`);
                    });
                  } else {
                    console.log(`  ❌ No hay mensajes para ${conv.phone_number}`);
                  }
                } catch (e) {
                  console.log(`  ❌ Error parseando mensajes: ${e.message}`);
                }
              });
            });
            
            messagesReq.on('error', (error) => {
              console.log(`  ❌ Error obteniendo mensajes: ${error.message}`);
            });
            
            messagesReq.end();
          });
          
        } else {
          console.log('\n❌ Error:', jsonData.error);
          if (jsonData.details) {
            console.log('💡 Detalles:', jsonData.details);
          }
        }
      } catch (e) {
        console.log('❌ Error parseando JSON:', e.message);
        console.log('📄 Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error de conexión:', error.message);
  });

  req.end();
}

console.log('🔍 Simulando exactamente lo que hace el frontend...');
simulateFrontend();
