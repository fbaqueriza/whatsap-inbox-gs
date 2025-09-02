const baseUrl = 'http://localhost:3001';

async function testEvioOrdenWithNames() {
  console.log('🧪 Verificando template evio_orden con nombres descriptivos...');

  // Test: Template evio_orden con variables dinámicas usando nombres descriptivos
  try {
    console.log('\n📤 Enviando template evio_orden con nombres descriptivos...');
    
    const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: '+5491135562673',
        message: 'evio_orden',
        templateVariables: {
          'Nombre Proveedor': 'Juan Pérez',
          'Proveedor': 'Distribuidora ABC'
        },
        userId: 'test-user-id'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Template evio_orden enviado exitosamente:');
      console.log('   - Message ID:', result.message_id);
      console.log('   - Recipient:', result.recipient);
      console.log('   - Content:', result.content);
      console.log('   - Simulated:', result.simulated);
      
      // Verificar que el contenido tiene las variables reemplazadas
      if (result.content.includes('Juan Pérez') && result.content.includes('Distribuidora ABC')) {
        console.log('✅ Variables reemplazadas correctamente en el contenido');
      } else {
        console.log('⚠️ Variables no reemplazadas en el contenido');
      }
    } else {
      console.log('❌ Error enviando template evio_orden:');
      console.log('   - Status:', response.status);
      console.log('   - Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

testEvioOrdenWithNames();
