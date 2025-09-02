// Script para probar el template evio_orden con variables
const testEvioOrdenWithVariables = async () => {
  try {
    console.log('🔍 Probando template evio_orden con variables...');
    
    const baseUrl = 'https://gastronomy-saas.vercel.app';
    const testData = {
      to: '+5491135562673', // Número de L'igiene (que funciona)
      message: 'evio_orden',
      templateVariables: {
        'Proveedor': 'L\'igiene',
        'Nombre Proveedor': 'Juan Pérez'
      },
      userId: 'test-user-id'
    };
    
    console.log('📤 Enviando request de prueba...');
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
      
      // Verificar si el contenido es correcto
      if (result.content.includes('NUEVA ORDEN') && result.content.includes('Juan Pérez')) {
        console.log('✅ Contenido del template correcto con variables');
      } else {
        console.log('❌ Contenido del template incorrecto');
      }
    } else {
      console.log('❌ Error enviando template:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
};

// Ejecutar test
testEvioOrdenWithVariables();
