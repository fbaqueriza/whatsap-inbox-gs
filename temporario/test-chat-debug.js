// Script para probar el endpoint de debug del chat
const testChatStatus = async () => {
  try {
    // Obtener token desde localStorage del navegador
    const token = localStorage.getItem('sb-jyalmdhyuftjldewbfzw-auth-token');
    if (!token) {
      console.log('❌ No se encontró token de autenticación');
      return;
    }

    const parsedToken = JSON.parse(token);
    const accessToken = parsedToken.access_token;

    console.log('🔍 Probando endpoint de debug del chat...');
    
    const response = await fetch('/api/debug/chat-status', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('📊 Resultado del debug:', result);

    if (result.success) {
      console.log('✅ Usuario:', result.debug.user);
      console.log('📱 Configuración:', result.debug.config);
      console.log('💬 Mensajes:', result.debug.messages);
      console.log('👥 Proveedores:', result.debug.providers);
    } else {
      console.error('❌ Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
};

// Ejecutar el test
testChatStatus();
