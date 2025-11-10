// Script para agregar mensajes de prueba al chat
const addTestMessages = async () => {
  try {
    // Obtener token desde localStorage del navegador
    const token = localStorage.getItem('sb-jyalmdhyuftjldewbfzw-auth-token');
    if (!token) {
      console.log('❌ No se encontró token de autenticación');
      return;
    }

    const parsedToken = JSON.parse(token);
    const accessToken = parsedToken.access_token;

    console.log('🔍 Agregando mensajes de prueba...');
    
    const response = await fetch('/api/debug/add-test-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    console.log('📊 Resultado:', result);

    if (result.success) {
      console.log('✅ ¡Mensajes de prueba agregados!');
      console.log('📱 Cantidad:', result.message);
      console.log('💬 Mensajes:', result.messages);
      
      // Recargar la página para ver los mensajes
      console.log('🔄 Recargando página en 2 segundos...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
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

// Ejecutar el script
addTestMessages();
