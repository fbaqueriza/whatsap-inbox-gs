// Test del template evio_orden con componentes simples
const baseUrl = 'http://localhost:3001';

async function testTemplateSimpleComponents() {
  console.log('🧪 Test del template evio_orden con componentes simples');
  
  const testData = {
    to: '+5491135562673',
    message: 'evio_orden',
    templateVariables: {
      'Proveedor': 'Test Provider',
      'Nombre Proveedor': 'Test Name'
    },
    userId: 'b5a237e6-c9f9-4561-af07-a1408825ab50'
  };

  console.log('📤 Enviando template evio_orden con componentes simples:', testData);

  try {
    const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('📥 Status:', response.status);
    
    const result = await response.json();
    console.log('📥 Resultado:', result);
    
    if (response.ok && result.success) {
      console.log('✅ Template enviado exitosamente');
      console.log('📋 Contenido guardado:', result.content);
      
      if (result.content === 'evio_orden') {
        console.log('❌ ERROR: El contenido sigue siendo "evio_orden"');
      } else {
        console.log('✅ CORRECTO: El contenido es el template real');
      }
    } else {
      console.log('❌ Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testTemplateSimpleComponents();
