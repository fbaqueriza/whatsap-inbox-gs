// Script simple para probar template evio_orden sin variables
const testSimpleEvioOrden = async () => {
  try {
    console.log('🔍 Probando template evio_orden simple...');
    
    const baseUrl = 'https://gastronomy-saas.vercel.app';
    const testData = {
      to: '+5491135562673',
      message: 'evio_orden',
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
      console.log('✅ Template evio_orden enviado exitosamente');
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
testSimpleEvioOrden();
