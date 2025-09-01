// Script para verificar el estado del template evio_orden
const testTemplateStatus = async () => {
  try {
    console.log('🔍 Verificando estado del template evio_orden...');
    
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
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    console.log('📥 Response body:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Template enviado exitosamente');
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
testTemplateStatus();
