// Script para configurar variables de entorno de Kapso
const setupKapsoEnv = async () => {
  try {
    // Obtener token desde localStorage del navegador
    const token = localStorage.getItem('sb-jyalmdhyuftjldewbfzw-auth-token');
    if (!token) {
      console.log('❌ No se encontró token de autenticación');
      return;
    }

    const parsedToken = JSON.parse(token);
    const accessToken = parsedToken.access_token;

    console.log('🔧 Configurando variables de entorno de Kapso...');
    
    const response = await fetch('/api/debug/setup-kapso-env', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('📊 Resultado de configuración:', result);

    if (result.success) {
      console.log('✅ ¡Variables de entorno configuradas!');
      console.log('🔧 Variables:', result.kapsoEnvVars);
      console.log('📱 Configuración del usuario:', result.userConfig);
      
      // Probar nuevamente la API de Kapso
      console.log('🔄 Probando API de Kapso nuevamente...');
      setTimeout(() => {
        testKapsoAPI();
      }, 1000);
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

// Función para probar la API de Kapso (reutilizada)
const testKapsoAPI = async () => {
  try {
    const token = localStorage.getItem('sb-jyalmdhyuftjldewbfzw-auth-token');
    if (!token) {
      console.log('❌ No se encontró token de autenticación');
      return;
    }

    const parsedToken = JSON.parse(token);
    const accessToken = parsedToken.access_token;

    console.log('🔍 Probando API de Kapso después de configuración...');
    
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
      
      // Verificar si hay conversaciones
      const hasConversationsByConfig = result.debug.conversationsByConfig.data && result.debug.conversationsByConfig.data.length > 0;
      const hasAllConversations = result.debug.allConversations.data && result.debug.allConversations.data.length > 0;
      
      console.log('📊 Resumen:');
      console.log('- Conversaciones por configuración:', hasConversationsByConfig ? '✅ Encontradas' : '❌ Vacías');
      console.log('- Todas las conversaciones:', hasAllConversations ? '✅ Encontradas' : '❌ Vacías');
      
      if (hasAllConversations && !hasConversationsByConfig) {
        console.log('🔍 Análisis: Hay conversaciones pero el filtro por configuración no funciona');
        console.log('💡 Posible problema: kapso_config_id no coincide con las conversaciones');
      }
      
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

// Ejecutar la configuración
setupKapsoEnv();
