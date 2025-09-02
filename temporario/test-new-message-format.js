// Script de prueba para el nuevo formato de mensaje
const testNewMessageFormat = async () => {
  try {
    console.log('🧪 Probando nuevo formato de mensaje...');
    
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
        }
      ],
      total_amount: 2300,
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
    
    const response = await fetch('http://localhost:3001/api/debug/test-new-message-format', {
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
    console.log('📝 Nuevo formato del mensaje:');
    console.log('─'.repeat(50));
    console.log(result.newFormat);
    console.log('─'.repeat(50));
    
    console.log('🔍 Información de debug:');
    console.log(JSON.stringify(result.debug, null, 2));
    
    // Verificar que el nuevo formato sea correcto
    const message = result.newFormat;
    const hasProviderInTitle = message.includes('*L\'IGIENE*');
    const hasOrderAsSubtitle = message.includes('*Orden:* ORD-20250901-L\'I-TEST');
    const noTotalItems = !message.includes('Total de items');
    
    console.log('\n🧪 Verificaciones:');
    console.log(`✅ Proveedor en título: ${hasProviderInTitle ? 'SÍ' : 'NO'}`);
    console.log(`✅ Número de orden como subtítulo: ${hasOrderAsSubtitle ? 'SÍ' : 'NO'}`);
    console.log(`✅ Sin enumeración de items: ${noTotalItems ? 'SÍ' : 'NO'}`);
    
    if (hasProviderInTitle && hasOrderAsSubtitle && noTotalItems) {
      console.log('\n🎉 ¡Nuevo formato implementado correctamente!');
    } else {
      console.log('\n⚠️ Algunas verificaciones fallaron');
    }
    
  } catch (error) {
    console.error('❌ Error en el test:', error);
  }
};

// Ejecutar el test
testNewMessageFormat();
