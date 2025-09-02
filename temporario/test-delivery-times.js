// Script de prueba para verificar horarios de entrega
const testDeliveryTimes = async () => {
  try {
    console.log('🧪 Probando horarios de entrega...');
    
    // Datos de prueba con diferentes escenarios de horarios
    const testScenarios = [
      {
        name: 'Proveedor con un horario de entrega',
        orderData: {
          id: 'test-order-1',
          order_number: 'ORD-20250901-L\'I-TEST1',
          order_date: new Date().toISOString(),
          notes: 'Notas de prueba',
          items: [
            {
              productName: 'Guantes Nitrilo M',
              quantity: 2,
              unit: 'caja',
              price: 1500
            }
          ],
          total_amount: 1500,
          currency: 'ARS',
          providers: {
            id: 'test-provider-1',
            name: 'L\'igiene',
            contact_name: 'fbaqueriza',
            notes: 'Notas del proveedor de prueba',
            default_payment_method: 'transferencia',
            default_delivery_time: ['15:00']
          }
        }
      },
      {
        name: 'Proveedor con múltiples horarios de entrega',
        orderData: {
          id: 'test-order-2',
          order_number: 'ORD-20250901-L\'I-TEST2',
          order_date: new Date().toISOString(),
          notes: 'Notas de prueba',
          items: [
            {
              productName: 'Papel de manos intercalados',
              quantity: 1,
              unit: 'bulto',
              price: 800
            }
          ],
          total_amount: 800,
          currency: 'ARS',
          providers: {
            id: 'test-provider-2',
            name: 'L\'igiene',
            contact_name: 'fbaqueriza',
            notes: 'Notas del proveedor de prueba',
            default_payment_method: 'efectivo',
            default_delivery_time: ['08:00', '14:00', '16:00']
          }
        }
      },
      {
        name: 'Proveedor sin horarios de entrega',
        orderData: {
          id: 'test-order-3',
          order_number: 'ORD-20250901-L\'I-TEST3',
          order_date: new Date().toISOString(),
          notes: 'Notas de prueba',
          items: [
            {
              productName: 'Bobina Papel industrial',
              quantity: 2,
              unit: 'rollo',
              price: 1200
            }
          ],
          total_amount: 1200,
          currency: 'ARS',
          providers: {
            id: 'test-provider-3',
            name: 'L\'igiene',
            contact_name: 'fbaqueriza',
            notes: 'Notas del proveedor de prueba',
            default_payment_method: 'tarjeta',
            default_delivery_time: []
          }
        }
      }
    ];

    for (const scenario of testScenarios) {
      console.log(`\n📋 Probando escenario: ${scenario.name}`);
      console.log('─'.repeat(60));
      
      const response = await fetch('http://localhost:3001/api/debug/test-delivery-times', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderData: scenario.orderData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('📝 Mensaje generado:');
      console.log('─'.repeat(40));
      console.log(result.message);
      console.log('─'.repeat(40));
      
      console.log('🔍 Verificaciones:');
      console.log(JSON.stringify(result.verification, null, 2));
      
      // Verificar que el escenario sea correcto
      const verification = result.verification;
      const hasDeliveryTimes = verification.hasDeliveryTimes;
      const hasNoSpecified = verification.hasNoSpecified;
      const hasItemsList = verification.hasItemsList;
      const deliveryTimeCount = result.debug.defaultDeliveryTime.length;
      
      console.log('\n🧪 Verificaciones específicas:');
      console.log(`✅ Con horarios de entrega: ${hasDeliveryTimes ? 'SÍ' : 'NO'}`);
      console.log(`✅ Con "No especificado": ${hasNoSpecified ? 'SÍ' : 'NO'}`);
      console.log(`✅ Con lista de items: ${hasItemsList ? 'SÍ' : 'NO'}`);
      console.log(`✅ Cantidad de horarios: ${deliveryTimeCount}`);
      
      // Verificar según el escenario
      if (scenario.name.includes('un horario')) {
        const hasSingleTime = result.message.includes('Horario de entrega: 15:00');
        console.log(`✅ Horario único correcto: ${hasSingleTime ? 'SÍ' : 'NO'}`);
      } else if (scenario.name.includes('múltiples horarios')) {
        const hasMultipleTimes = result.message.includes('Horarios de entrega: 08:00, 14:00, 16:00');
        console.log(`✅ Múltiples horarios correctos: ${hasMultipleTimes ? 'SÍ' : 'NO'}`);
      } else if (scenario.name.includes('sin horarios')) {
        const hasNoSpecified = result.message.includes('Horario de entrega: No especificado');
        console.log(`✅ Sin horarios correcto: ${hasNoSpecified ? 'SÍ' : 'NO'}`);
      }
    }
    
    console.log('\n🎉 ¡Todos los tests de horarios de entrega completados exitosamente!');
    console.log('\n💡 Para probar en el navegador:');
    console.log('1. Crear una nueva orden');
    console.log('2. Verificar que se envíe la notificación WhatsApp');
    console.log('3. Confirmar que aparezcan los horarios de entrega');
    console.log('4. Verificar que el formato sea correcto');
    
  } catch (error) {
    console.error('❌ Error en el test:', error);
  }
};

// Ejecutar el test
testDeliveryTimes();
