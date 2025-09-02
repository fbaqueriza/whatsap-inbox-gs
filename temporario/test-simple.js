// Script simple para probar la lógica de formateo
console.log('🧪 TEST - Probando lógica de formateo...');

// Simular los datos que vienen de la base de datos
const orderData = {
  order_date: '2025-09-02T00:00:00.000Z',
  desired_delivery_date: '2025-09-05T00:00:00.000Z',
  payment_method: 'cheque',
  providers: {
    default_payment_method: 'transferencia'
  }
};

console.log('📅 order_date:', orderData.order_date);
console.log('📅 desired_delivery_date:', orderData.desired_delivery_date);
console.log('💳 payment_method:', orderData.payment_method);
console.log('💳 providers.default_payment_method:', orderData.providers.default_payment_method);

// Probar formateo de fechas
const orderDate = new Date(orderData.order_date);
const desiredDate = new Date(orderData.desired_delivery_date);

console.log('\n📅 Fechas formateadas:');
console.log('order_date formateada:', orderDate.toLocaleDateString('es-AR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}));

console.log('desired_delivery_date formateada:', desiredDate.toLocaleDateString('es-AR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}));

// Probar lógica de método de pago
const getPaymentMethodText = (method) => {
  const paymentMethods = {
    'efectivo': 'Efectivo',
    'transferencia': 'Transferencia',
    'tarjeta': 'Tarjeta',
    'cheque': 'Cheque'
  };
  return paymentMethods[method] || method || 'No especificado';
};

console.log('\n💳 Métodos de pago:');
console.log('payment_method del modal:', getPaymentMethodText(orderData.payment_method));
console.log('default_payment_method del proveedor:', getPaymentMethodText(orderData.providers.default_payment_method));

// Simular la lógica de la función
let paymentMethod = 'Efectivo';
if (orderData.payment_method) {
  paymentMethod = getPaymentMethodText(orderData.payment_method);
  console.log('🔧 DEBUG - Método de pago del modal:', paymentMethod);
} else if (orderData.providers?.default_payment_method) {
  paymentMethod = getPaymentMethodText(orderData.providers.default_payment_method);
  console.log('🔧 DEBUG - Método de pago del proveedor:', paymentMethod);
}

console.log('\n✅ Método de pago final:', paymentMethod);
