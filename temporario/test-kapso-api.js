// Script para probar la API de Kapso directamente
const testKapsoAPI = async () => {
  try {
    // Obtener token desde localStorage del navegador
    const token = localStorage.getItem('sb-jyalmdhyuftjldewbfzw-auth-token');
    if (!token) {
      console.log('❌ No se encontró token de autenticación');
      return;
    }

    const parsedToken = JSON.parse(token);
    const accessToken = parsedToken.access_token;

    console.log('🔍 Probando API de Kapso directamente...');
    
    const response = await fetch('/api/debug/kapso-test', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('📊 Resultado del test de Kapso:', result);

    if (result.success) {
      console.log('✅ Usuario:', result.debug.user);
      console.log('📱 Configuración:', result.debug.config);
      console.log('🔧 Variables de entorno Kapso:', result.debug.kapsoEnvVars);
      console.log('💬 Conversaciones por configuración:', result.debug.conversationsByConfig);
      console.log('📞 Todas las conversaciones:', result.debug.allConversations);
      
      // Analizar resultados
      if (result.debug.conversationsByConfig.error) {
        console.error('❌ Error en conversaciones por configuración:', result.debug.conversationsByConfig.error);
      }
      
      if (result.debug.allConversations.error) {
        console.error('❌ Error en todas las conversaciones:', result.debug.allConversations.error);
      }
      
      // Verificar si hay conversaciones
      const hasConversationsByConfig = result.debug.conversationsByConfig.data && result.debug.conversationsByConfig.data.length > 0;
      const hasAllConversations = result.debug.allConversations.data && result.debug.allConversations.data.length > 0;
      
      console.log('📊 Resumen:');
      console.log('- Conversaciones por configuración:', hasConversationsByConfig ? '✅ Encontradas' : '❌ Vacías');
      console.log('- Todas las conversaciones:', hasAllConversations ? '✅ Encontradas' : '❌ Vacías');
      
    } else {
      console.error('❌ Error:', result.error);
      if (result.details) {
        console.log('💡 Detalles:', result.details);
      }
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
};

// Ejecutar el test
testKapsoAPI();
