// Script para probar el template inicializador_de_conv
const testInicializadorConv = async () => {
  try {
    console.log('🔍 Probando template inicializador_de_conv...');
    
    const baseUrl = 'https://gastronomy-saas.vercel.app';
    const testData = {
      to: '+5491135562673',
      message: 'inicializador_de_conv',
      userId: 'test-user-id'
    };
    
    console.log('📤 Enviando request...');
    console.log('📋 Datos:', JSON.stringify(testData, null, 2));
    
    const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    console.log('📥 Response status:', response.status);
    
    const result = await response.json();
    console.log('📥 Response body:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Template inicializador_de_conv enviado exitosamente');
      console.log('📱 Message ID:', result.message_id);
      console.log('📝 Content:', result.content);
    } else {
      console.log('❌ Error enviando template:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
};

// Ejecutar test
testInicializadorConv();
