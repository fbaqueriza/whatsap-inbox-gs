// Test simple para debuggear el API de WhatsApp send
const baseUrl = 'http://localhost:3001';

async function testSimpleSend() {
  console.log('🧪 Test simple del API WhatsApp send');
  
  const testData = {
    to: '+5491135562673',
    message: 'Test simple desde script',
    userId: 'b5a237e6-c9f9-4561-af07-a1408825ab50'
  };

  console.log('📤 Enviando mensaje simple:', testData);

  try {
    const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('📥 Status:', response.status);
    console.log('📥 Headers:', response.headers);
    
    const result = await response.json();
    console.log('📥 Resultado:', result);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testSimpleSend();
