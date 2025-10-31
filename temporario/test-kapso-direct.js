// Script simple para probar el endpoint directo de Kapso
const http = require('http');

function testKapsoDirect() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/debug/kapso-direct',
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
      console.log('📄 Response:', data);
      
      try {
        const jsonData = JSON.parse(data);
        console.log('📊 JSON Response:', JSON.stringify(jsonData, null, 2));
        
        if (jsonData.success) {
          console.log('\n✅ Test exitoso!');
          console.log('👤 Usuario:', jsonData.debug.user);
          console.log('📱 Configuración:', jsonData.debug.config);
          console.log('🔧 Variables de entorno:', jsonData.debug.kapsoEnvVars);
          console.log('📞 Todas las conversaciones:', jsonData.debug.allConversations);
          console.log('💬 Conversaciones por configuración:', jsonData.debug.conversationsByConfig);
          
          // Analizar resultados
          const hasAllConversations = jsonData.debug.allConversations.data && jsonData.debug.allConversations.data.length > 0;
          const hasConversationsByConfig = jsonData.debug.conversationsByConfig.data && jsonData.debug.conversationsByConfig.data.length > 0;
          
          console.log('\n📊 Resumen:');
          console.log('- Todas las conversaciones:', hasAllConversations ? '✅ Encontradas' : '❌ Vacías');
          console.log('- Conversaciones por configuración:', hasConversationsByConfig ? '✅ Encontradas' : '❌ Vacías');
          
          if (hasAllConversations && !hasConversationsByConfig) {
            console.log('\n🔍 Análisis: Hay conversaciones pero el filtro por configuración no funciona');
            console.log('💡 Posible problema: kapso_config_id no coincide con las conversaciones');
            
            // Mostrar detalles de las conversaciones
            if (jsonData.debug.allConversations.data) {
              console.log('\n📋 Detalles de conversaciones:');
              jsonData.debug.allConversations.data.forEach((conv, index) => {
                console.log(`  ${index + 1}. ID: ${conv.id}, Phone: ${conv.phone_number}, Config: ${conv.whatsapp_config_id}`);
              });
            }
          }
        } else {
          console.log('\n❌ Error:', jsonData.error);
          if (jsonData.details) {
            console.log('💡 Detalles:', jsonData.details);
          }
        }
      } catch (e) {
        console.log('❌ Error parseando JSON:', e.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error de conexión:', error.message);
  });

  req.end();
}

console.log('🔍 Probando endpoint directo de Kapso...');
testKapsoDirect();
