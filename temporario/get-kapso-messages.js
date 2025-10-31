// Script para ver los detalles completos de los mensajes de Kapso
const http = require('http');

function getKapsoMessages() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/debug/kapso-messages',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
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
          console.log('\n✅ Mensajes obtenidos exitosamente!');
          console.log('📞 Conversaciones:', jsonData.conversations.length);
          console.log('💬 Mensajes totales:', jsonData.messages.length);
          
          console.log('\n📋 Detalles de conversaciones:');
          jsonData.conversations.forEach((conv, index) => {
            console.log(`  ${index + 1}. ID: ${conv.id}`);
            console.log(`     Phone: ${conv.phone_number}`);
            console.log(`     Contact: ${conv.contact_name}`);
            console.log(`     Status: ${conv.status}`);
            console.log(`     Last Active: ${conv.last_active_at}`);
            console.log('');
          });
          
          console.log('\n💬 Detalles de mensajes:');
          jsonData.messages.forEach((msg, index) => {
            console.log(`  ${index + 1}. ID: ${msg.id}`);
            console.log(`     Conversation: ${msg.conversation_id}`);
            console.log(`     Content: ${msg.content}`);
            console.log(`     Direction: ${msg.direction}`);
            console.log(`     Type: ${msg.type}`);
            console.log(`     Status: ${msg.status}`);
            console.log(`     Timestamp: ${msg.timestamp}`);
            if (msg.media_url) {
              console.log(`     Media: ${msg.media_url}`);
            }
            console.log('');
          });
          
          // Analizar el problema
          console.log('\n🔍 Análisis del problema:');
          console.log('✅ Hay conversaciones en Kapso');
          console.log('✅ Hay mensajes en Kapso');
          console.log('❌ El endpoint /api/kapso/chat?action=messages no los devuelve');
          console.log('\n💡 Posible causa: El método getMessagesForPhone en KapsoService no funciona correctamente');
          
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

console.log('🔍 Obteniendo mensajes directamente de Kapso...');
getKapsoMessages();
