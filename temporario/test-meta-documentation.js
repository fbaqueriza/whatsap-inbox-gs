// Script para probar diferentes formatos según la documentación de Meta
const testMetaFormats = async () => {
  try {
    console.log('🔍 Probando diferentes formatos según documentación de Meta...');
    
    const baseUrl = 'https://gastronomy-saas.vercel.app';
    
    // FORMATO 1: Template sin componentes (solo nombre)
    console.log('\n📤 Probando FORMATO 1: Template sin componentes...');
    const testData1 = {
      to: '+5491135562673',
      message: 'evio_orden',
      userId: 'test-user-id'
    };
    
    const response1 = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData1),
    });
    
    console.log('📥 Response 1 status:', response1.status);
    const result1 = await response1.json();
    console.log('📥 Response 1 body:', JSON.stringify(result1, null, 2));
    
    // FORMATO 2: Template con componentes vacíos
    console.log('\n📤 Probando FORMATO 2: Template con componentes vacíos...');
    const testData2 = {
      to: '+5491135562673',
      message: 'evio_orden',
      templateVariables: {},
      userId: 'test-user-id'
    };
    
    const response2 = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData2),
    });
    
    console.log('📥 Response 2 status:', response2.status);
    const result2 = await response2.json();
    console.log('📥 Response 2 body:', JSON.stringify(result2, null, 2));
    
    // FORMATO 3: Template con variables pero sin enviar componentes
    console.log('\n📤 Probando FORMATO 3: Template con variables pero sin componentes...');
    const testData3 = {
      to: '+5491135562673',
      message: 'evio_orden',
      templateVariables: {
        'Proveedor': 'L\'igiene',
        'Nombre Proveedor': 'Juan Pérez'
      },
      userId: 'test-user-id'
    };
    
    const response3 = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData3),
    });
    
    console.log('📥 Response 3 status:', response3.status);
    const result3 = await response3.json();
    console.log('📥 Response 3 body:', JSON.stringify(result3, null, 2));
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
};

// Ejecutar test
testMetaFormats();
