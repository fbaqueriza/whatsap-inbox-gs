// Test del flujo completo de notificación de órdenes con el template correcto
const baseUrl = 'http://localhost:3001';

async function testOrderNotificationFlow() {
  console.log('🧪 INICIANDO PRUEBA DEL FLUJO COMPLETO DE NOTIFICACIÓN');
  
  // Simular datos de una orden
  const orderData = {
    id: 'test-order-' + Date.now(),
    orderNumber: 'ORD-' + Date.now(),
    providerId: '4e0c6eec-dee9-4cea-ad9b-d2476fb30409', // ID de L'igiene
    status: 'pending',
    items: [
      {
        productName: 'Producto de prueba',
        quantity: 5,
        unit: 'unidades'
      }
    ],
    totalAmount: 1000,
    currency: 'ARS'
  };

  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';

  console.log('📦 Datos de la orden:', orderData);

  try {
    // Simular el envío de notificación usando el endpoint de órdenes
    const response = await fetch(`${baseUrl}/api/orders/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: orderData,
        userId: userId
      }),
    });

    console.log('📥 Status:', response.status);
    
    const result = await response.json();
    console.log('📥 Resultado:', result);
    
    if (response.ok && result.success) {
      console.log('✅ Notificación de orden enviada exitosamente');
      console.log('📋 Detalles:', {
        templateSent: result.templateSent,
        pendingOrderSaved: result.pendingOrderSaved,
        errors: result.errors
      });
    } else {
      console.log('❌ Error en notificación:', result.error || result.errors);
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testOrderNotificationFlow();
