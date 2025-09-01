// Script para probar el template localmente
const testLocalTemplate = async () => {
  try {
    console.log('🔍 Probando template localmente...');
    
    const baseUrl = 'http://localhost:3001';
    const testData = {
      to: '+5491135562673',
      message: 'evio_orden',
      templateVariables: {
        'Proveedor': 'L\'igiene',
        'Nombre Proveedor': 'Juan Pérez'
      },
      userId: 'test-user-id'
    };
    
    console.log('📤 Enviando request local...');
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
      console.log('✅ Template enviado exitosamente');
      console.log('📱 Message ID:', result.message_id);
      console.log('📝 Content:', result.content);
      
      // Verificar si el contenido es correcto
      if (result.content.includes('NUEVA ORDEN') && result.content.includes('Juan Pérez')) {
        console.log('✅ Contenido del template correcto');
      } else {
        console.log('❌ Contenido del template incorrecto');
      }
    } else {
      console.log('❌ Error enviando template:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en test local:', error);
  }
};

// Ejecutar test
testLocalTemplate();
