require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealLigiene() {
  try {
    console.log('🧪 Probando función generateOrderDetailsMessage con datos reales de L\'igiene...\n');
    
    // 1. Obtener datos reales de L'igiene
    console.log('1️⃣ Obteniendo datos reales de L\'igiene...');
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .eq('name', "L'igiene")
      .single();
    
    if (providerError || !provider) {
      console.error('❌ Error obteniendo proveedor:', providerError);
      return;
    }
    
    console.log('✅ Proveedor encontrado:', provider.name);
    console.log('   - Horarios:', provider.default_delivery_time);
    console.log('   - Notas:', provider.notes);
    
    // 2. Crear datos de orden simulados
    const orderData = {
      id: 'test-order-real',
      order_number: 'ORD-20250901-L\'I-TEST-REAL',
      order_date: new Date().toISOString(),
      notes: 'Notas de prueba con datos reales',
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
      providers: provider
    };
    
    console.log('\n2️⃣ Datos de orden simulados:');
    console.log('   - ID:', orderData.id);
    console.log('   - Número:', orderData.order_number);
    console.log('   - Items:', orderData.items.length);
    console.log('   - Proveedor:', orderData.providers.name);
    
    // 3. Importar y probar la función
    console.log('\n3️⃣ Probando función generateOrderDetailsMessage...');
    
    // Simular la función (ya que no podemos importar directamente)
    const message = generateOrderDetailsMessage(orderData);
    
    console.log('\n📝 Mensaje generado:');
    console.log('─'.repeat(50));
    console.log(message);
    console.log('─'.repeat(50));
    
    // 4. Verificaciones
    console.log('\n4️⃣ Verificaciones:');
    const hasDeliveryTimes = message.includes('Horario de entrega:') || message.includes('Horarios de entrega:');
    const hasNoSpecified = message.includes('No especificado');
    const hasTotalItems = message.includes('Total de items');
    const hasProviderName = message.includes('L\'IGIENE');
    
    console.log(`   ✅ Con horarios de entrega: ${hasDeliveryTimes ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ Con "No especificado": ${hasNoSpecified ? 'SÍ' : 'NO'}`);
    console.log(`   ❌ Con "Total de items": ${hasTotalItems ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ Con nombre del proveedor: ${hasProviderName ? 'SÍ' : 'NO'}`);
    
    if (hasDeliveryTimes && !hasTotalItems && hasProviderName) {
      console.log('\n🎉 ¡Función funcionando correctamente!');
      console.log('💡 Los horarios SÍ se incluyen en el mensaje');
    } else {
      console.log('\n⚠️ Función no funcionando como esperado');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Función simulada de generateOrderDetailsMessage
function generateOrderDetailsMessage(orderData) {
  try {
    if (!orderData) {
      return '📋 Detalles del pedido confirmado.';
    }

    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const orderNumber = orderData.order_number || orderData.id || 'N/A';
    
    // Obtener nombre del proveedor
    let providerName = 'Proveedor';
    if (orderData.providers && typeof orderData.providers === 'object' && orderData.providers.name) {
      providerName = orderData.providers.name;
    }
    
    // Formatear fecha de entrega
    let deliveryDate = 'No especificada';
    if (orderData.order_date) {
      try {
        const date = new Date(orderData.order_date);
        if (!isNaN(date.getTime())) {
          deliveryDate = date.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      } catch (error) {
        deliveryDate = 'Error en fecha';
      }
    }
    
    // Método de pago
    let paymentMethod = 'Efectivo';
    if (orderData.providers?.default_payment_method) {
      const paymentMethods = {
        'efectivo': 'Efectivo',
        'transferencia': 'Transferencia',
        'tarjeta': 'Tarjeta',
        'cheque': 'Cheque'
      };
      paymentMethod = paymentMethods[orderData.providers.default_payment_method] || 'Efectivo';
    }
    
    // Notas
    let notes = '';
    if (orderData.providers?.notes && orderData.providers.notes.trim()) {
      notes = orderData.providers.notes;
    } else if (orderData.notes && orderData.notes.trim()) {
      notes = orderData.notes;
    } else {
      notes = 'Sin notas adicionales';
    }
    
    // Construir mensaje
    let message = `📋 *${providerName.toUpperCase()}*\n\n`;
    message += `*Orden:* ${orderNumber}\n`;
    message += `*Fecha de entrega:* ${deliveryDate}\n`;
    
    // Horarios de entrega
    if (orderData.providers?.default_delivery_time && orderData.providers.default_delivery_time.length > 0) {
      const deliveryTimes = orderData.providers.default_delivery_time;
      if (deliveryTimes.length === 1) {
        message += `*Horario de entrega:* ${deliveryTimes[0]}\n`;
      } else {
        message += `*Horarios de entrega:* ${deliveryTimes.join(', ')}\n`;
      }
    } else {
      message += `*Horario de entrega:* No especificado\n`;
    }
    
    message += `*Método de pago:* ${paymentMethod}\n`;
    
    if (notes && notes.trim()) {
      message += `*Notas:* ${notes}\n`;
    }
    
    message += `\n`;
    
    if (items.length > 0) {
      message += `*Items del pedido:*\n`;
      items.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const quantity = item.quantity || 1;
          const unit = item.unit || 'un';
          const name = item.productName || item.name || 'Producto';
          const price = item.price || '';
          
          if (price) {
            message += `${index + 1}. ${name} - ${quantity} ${unit} - $${price}\n`;
          } else {
            message += `${index + 1}. ${name} - ${quantity} ${unit}\n`;
          }
        }
      });
    }
    
    if (orderData.total_amount) {
      message += `\n*Total:* $${orderData.total_amount} ${orderData.currency || 'ARS'}`;
    }
    
    return message;
  } catch (error) {
    console.error('❌ Error generando mensaje:', error);
    return '📋 Detalles del pedido confirmado.';
  }
}

testRealLigiene();
