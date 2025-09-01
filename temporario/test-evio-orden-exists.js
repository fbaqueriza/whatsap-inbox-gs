// Test para verificar si el template evio_orden existe y funciona
const baseUrl = 'http://localhost:3001';

async function testEvioOrdenExists() {
  console.log('🧪 Verificando si el template evio_orden existe...');
  
  const testData = {
    to: '+5491135562673',
    message: 'evio_orden',
    userId: 'b5a237e6-c9f9-4561-af07-a1408825ab50'
  };

  console.log('📤 Enviando template evio_orden:', testData);

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
      console.log('✅ Template evio_orden funciona correctamente');
      console.log('📋 Contenido enviado:', result.content);
    } else {
      console.log('❌ Error con template evio_orden:', result.error);
      
      // Si falla, probar con envio_de_orden como fallback
      console.log('🔄 Probando con template envio_de_orden como fallback...');
      
      const fallbackData = {
        to: '+5491135562673',
        message: 'envio_de_orden',
        userId: 'b5a237e6-c9f9-4561-af07-a1408825ab50'
      };
      
      const fallbackResponse = await fetch(`${baseUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackData),
      });
      
      const fallbackResult = await fallbackResponse.json();
      console.log('📥 Fallback resultado:', fallbackResult);
      
      if (fallbackResponse.ok && fallbackResult.success) {
        console.log('✅ Template envio_de_orden funciona como fallback');
      } else {
        console.log('❌ Ambos templates fallaron');
      }
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testEvioOrdenExists();
