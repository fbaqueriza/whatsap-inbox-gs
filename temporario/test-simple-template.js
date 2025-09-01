// Script simple para probar template básico
const testSimpleTemplate = async () => {
  try {
    console.log('🔍 Probando template simple...');
    
    const baseUrl = 'http://localhost:3001';
    const testData = {
      to: '+5491135562673',
      message: 'hello_world', // Template simple sin variables
      userId: 'test-user-id'
    };
    
    console.log('📤 Enviando request simple...');
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
      console.log('✅ Template simple enviado exitosamente');
      console.log('📱 Message ID:', result.message_id);
      console.log('📝 Content:', result.content);
    } else {
      console.log('❌ Error enviando template:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en test simple:', error);
  }
};

// Ejecutar test
testSimpleTemplate();
