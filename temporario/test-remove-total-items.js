// Script de prueba para verificar eliminación de totalItems
const testRemoveTotalItems = async () => {
  try {
    console.log('🧪 Probando eliminación de totalItems...');
    
    // Datos de prueba similares a los que se usan en producción
    const testOrderData = {
      id: 'test-order-123',
      order_number: 'ORD-20250901-L\'I-TEST',
      order_date: new Date().toISOString(),
      notes: 'Notas de prueba',
      items: [
        {
          productName: 'Guantes Nitrilo M',
          quantity: 2,
          unit: 'caja',
          price: 1500
        },
        {
          productName: 'Papel de manos intercalados',
          quantity: 1,
          unit: 'bulto',
          price: 800
        },
        {
          productName: 'Bobina Papel industrial',
          quantity: 2,
          unit: 'rollo',
          price: 1200
        }
      ],
      total_amount: 3500,
      currency: 'ARS',
      providers: {
        id: 'test-provider-456',
        name: 'L\'igiene',
        contact_name: 'fbaqueriza',
        notes: 'Notas del proveedor de prueba',
        default_payment_method: 'transferencia'
      }
    };

    console.log('📤 Enviando datos de prueba...');
    
    const response = await fetch('http://localhost:3001/api/debug/test-remove-total-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderData: testOrderData }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Resultado del test:');
    console.log('📝 Mensaje generado:');
    console.log('─'.repeat(50));
    console.log(result.message);
    console.log('─'.repeat(50));
    
    console.log('🔍 Verificaciones:');
    console.log(JSON.stringify(result.verification, null, 2));
    
    // Verificar que el cambio sea correcto
    const verification = result.verification;
    const noTotalItems = !verification.hasTotalItems;
    const hasItemsList = verification.hasItemsList;
    const correctItemsCount = verification.itemsCount === 3;
    
    console.log('\n🧪 Verificaciones específicas:');
    console.log(`✅ Sin "Total de items": ${noTotalItems ? 'SÍ' : 'NO'}`);
    console.log(`✅ Con lista de items: ${hasItemsList ? 'SÍ' : 'NO'}`);
    console.log(`✅ Cantidad correcta de items: ${correctItemsCount ? 'SÍ' : 'NO'} (${verification.itemsCount})`);
    
    if (noTotalItems && hasItemsList && correctItemsCount) {
      console.log('\n🎉 ¡Eliminación de totalItems implementada correctamente!');
      console.log('✅ El mensaje no contiene "Total de items"');
      console.log('✅ Los items individuales se muestran correctamente');
      console.log('✅ La funcionalidad se mantiene intacta');
    } else {
      console.log('\n⚠️ Algunas verificaciones fallaron');
    }
    
    console.log('\n💡 Para probar en el navegador:');
    console.log('1. Crear una nueva orden');
    console.log('2. Verificar que se envíe la notificación WhatsApp');
    console.log('3. Confirmar que NO aparezca "Total de items"');
    console.log('4. Confirmar que SÍ aparezcan los items individuales');
    
  } catch (error) {
    console.error('❌ Error en el test:', error);
  }
};

// Ejecutar el test
testRemoveTotalItems();
