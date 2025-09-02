const { OrderNotificationService } = require('../src/lib/orderNotificationService.ts');

// Datos de prueba que simulan exactamente lo que viene de la base de datos
const testOrderData = {
  id: 'test-order-123',
  order_number: "ORD-20250902-L'I-42UC",
  order_date: '2025-09-02T00:00:00.000Z', // martes, 2 de septiembre de 2025
  desired_delivery_date: '2025-09-05T00:00:00.000Z', // viernes, 5 de septiembre de 2025
  desired_delivery_time: ['Mañana'],
  payment_method: 'cheque',
  notes: 'FACTURA Anmn',
  providers: {
    name: "L'igiene",
    default_payment_method: 'transferencia',
    default_delivery_time: ['Tarde']
  },
  items: [
    { productName: 'Guantes Nitrilo M', quantity: 2, unit: 'caja' },
    { productName: 'Papel de manos intercalados', quantity: 1, unit: 'bulto' },
    { productName: 'Bobina Papel indutrial', quantity: 2, unit: 'rollo' }
  ]
};

console.log('🧪 TEST - Datos de entrada:');
console.log(JSON.stringify(testOrderData, null, 2));

console.log('\n🧪 TEST - Ejecutando generateOrderDetailsMessage...');
const result = OrderNotificationService.generateOrderDetailsMessage(testOrderData);

console.log('\n🧪 TEST - Resultado:');
console.log(result);

// Verificar si contiene los datos correctos
console.log('\n🧪 VERIFICACIÓN:');
console.log('✅ Contiene fecha deseada (5 de septiembre):', result.includes('5 de septiembre'));
console.log('✅ Contiene método de pago (cheque):', result.includes('cheque'));
console.log('✅ Contiene horarios deseados (Mañana):', result.includes('Mañana'));
console.log('✅ Contiene notas (FACTURA Anmn):', result.includes('FACTURA Anmn'));
console.log('❌ Contiene fecha por defecto (2 de septiembre):', result.includes('2 de septiembre'));
console.log('❌ Contiene método por defecto (transferencia):', result.includes('transferencia'));
