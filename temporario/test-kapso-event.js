// Script para probar eventos de Kapso
// Usar fetch nativo de Node.js 18+

const testKapsoEvent = async () => {
  const ngrokUrl = 'https://20690ec1f69d.ngrok-free.app';
  const endpoint = `${ngrokUrl}/api/kapso/supabase-events`;
  
  console.log('🧪 Probando evento de Kapso...');
  
  // Simular evento de mensaje recibido
  const messageEvent = {
    type: 'message_received',
    payload: {
      messageId: 'test_msg_' + Date.now(),
      content: 'Mensaje de prueba desde Kapso',
      from: '5491135562673',
      timestamp: new Date().toISOString()
    }
  };
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageEvent)
    });
    
    const result = await response.json();
    console.log('✅ Respuesta del endpoint:', result);
    
    if (response.ok) {
      console.log('🎉 Evento de Kapso enviado exitosamente');
    } else {
      console.log('❌ Error enviando evento:', result);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
};

testKapsoEvent();
