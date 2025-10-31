// Script Node.js para probar los endpoints de Kapso
const https = require('https');
const http = require('http');

// Función para hacer requests HTTP
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Función principal
async function testKapsoEndpoints() {
  try {
    console.log('🔧 Probando endpoints de Kapso...\n');

    // 1. Probar endpoint de configuración
    console.log('1️⃣ Probando endpoint de configuración...');
    const setupResponse = await makeRequest('http://localhost:3001/api/debug/setup-kapso-env', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY
      }
    });

    console.log('📊 Respuesta de configuración:', setupResponse);
    
    if (setupResponse.status === 200 && setupResponse.data.success) {
      console.log('✅ Variables de entorno configuradas correctamente');
      console.log('🔧 Variables:', setupResponse.data.kapsoEnvVars);
      console.log('📱 Configuración del usuario:', setupResponse.data.userConfig);
    } else {
      console.log('❌ Error en configuración:', setupResponse.data);
    }

    console.log('\n2️⃣ Probando endpoint de test de Kapso...');
    
    // 2. Probar endpoint de test de Kapso
    const testResponse = await makeRequest('http://localhost:3001/api/debug/kapso-test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY
      }
    });

    console.log('📊 Respuesta de test de Kapso:', testResponse);
    
    if (testResponse.status === 200 && testResponse.data.success) {
      console.log('✅ Test de Kapso exitoso');
      console.log('🔧 Variables de entorno:', testResponse.data.debug.kapsoEnvVars);
      console.log('💬 Conversaciones por configuración:', testResponse.data.debug.conversationsByConfig);
      console.log('📞 Todas las conversaciones:', testResponse.data.debug.allConversations);
      
      // Analizar resultados
      const hasConversationsByConfig = testResponse.data.debug.conversationsByConfig.data && testResponse.data.debug.conversationsByConfig.data.length > 0;
      const hasAllConversations = testResponse.data.debug.allConversations.data && testResponse.data.debug.allConversations.data.length > 0;
      
      console.log('\n📊 Resumen:');
      console.log('- Conversaciones por configuración:', hasConversationsByConfig ? '✅ Encontradas' : '❌ Vacías');
      console.log('- Todas las conversaciones:', hasAllConversations ? '✅ Encontradas' : '❌ Vacías');
      
      if (hasAllConversations && !hasConversationsByConfig) {
        console.log('\n🔍 Análisis: Hay conversaciones pero el filtro por configuración no funciona');
        console.log('💡 Posible problema: kapso_config_id no coincide con las conversaciones');
        
        // Mostrar detalles de las conversaciones
        if (testResponse.data.debug.allConversations.data) {
          console.log('\n📋 Detalles de conversaciones:');
          testResponse.data.debug.allConversations.data.forEach((conv, index) => {
            console.log(`  ${index + 1}. ID: ${conv.id}, Phone: ${conv.phone_number}, Config: ${conv.whatsapp_config_id}`);
          });
        }
      }
      
    } else {
      console.log('❌ Error en test de Kapso:', testResponse.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar el test
testKapsoEndpoints();
