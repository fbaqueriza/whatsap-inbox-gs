require('dotenv').config({ path: '.env.local' });

async function testCorreccionHorarios() {
  try {
    console.log('🧪 Probando corrección de horarios en detalles del pedido...\n');
    
    // 1. Crear una nueva orden
    console.log('1️⃣ Creando nueva orden...');
    const createOrderResponse = await fetch('http://localhost:3001/api/orders/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: {
          id: `test-horarios-${Date.now()}`,
          order_number: `ORD-TEST-HORARIOS-${Date.now()}`,
          providerId: '4e0c6eec-dee9-4cea-ad9b-d2476fb30409', // L'igiene
          items: [
            {
              productName: 'Producto de prueba horarios',
              quantity: 1,
              unit: 'unidad',
              price: 1000
            }
          ],
          total_amount: 1000,
          currency: 'ARS'
        },
        userId: 'test-user-horarios'
      })
    });
    
    if (!createOrderResponse.ok) {
      console.error('❌ Error creando orden:', await createOrderResponse.text());
      return;
    }
    
    const createResult = await createOrderResponse.json();
    console.log('✅ Orden creada:', createResult);
    
    // 2. Esperar un momento
    console.log('\n2️⃣ Esperando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Simular respuesta del proveedor
    console.log('\n3️⃣ Simulando respuesta del proveedor...');
    const webhookResponse = await fetch('http://localhost:3001/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test-entry',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15491135562673',
                phone_number_id: 'test-phone-id'
              },
              messages: [{
                from: '5491135562673', // Número de L'igiene
                id: `test-msg-${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000),
                text: {
                  body: 'sí confirmo'
                },
                type: 'text'
              }]
            },
            field: 'messages'
          }]
        }]
      })
    });
    
    if (!webhookResponse.ok) {
      console.error('❌ Error enviando webhook:', await webhookResponse.text());
      return;
    }
    
    const webhookResult = await webhookResponse.json();
    console.log('✅ Webhook procesado:', webhookResult);
    
    console.log('\n🎉 Test completado!');
    console.log('💡 Revisa los logs del servidor para ver si aparecen los horarios');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

testCorreccionHorarios();
