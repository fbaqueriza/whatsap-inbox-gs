// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Variables de entorno cargadas:');
console.log('   SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ Faltante');
console.log('   SUPABASE_KEY:', supabaseKey ? '✅ Configurada' : '❌ Faltante');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarFlujoCompleto() {
  console.log('🔍 VERIFICACIÓN COMPLETA DEL FLUJO DE ÓRDENES');
  console.log('=' .repeat(50));

  try {
    // 1. Verificar conexión a Supabase
    console.log('\n1️⃣ Verificando conexión a Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('providers')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error de conexión:', testError);
      return;
    }
    console.log('✅ Conexión a Supabase exitosa');

    // 2. Verificar proveedor específico
    console.log('\n2️⃣ Verificando proveedor +5491135562673...');
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .or(`phone.eq.+5491135562673,phone.eq.5491135562673`);

    if (providerError) {
      console.error('❌ Error buscando proveedor:', providerError);
      return;
    }

    if (!providers || providers.length === 0) {
      console.error('❌ Proveedor no encontrado');
      return;
    }

    const provider = providers[0];
    console.log('✅ Proveedor encontrado:', {
      id: provider.id,
      name: provider.name,
      phone: provider.phone,
      user_id: provider.user_id
    });

    // 3. Verificar órdenes recientes
    console.log('\n3️⃣ Verificando órdenes recientes...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        providers(name, phone)
      `)
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersError) {
      console.error('❌ Error obteniendo órdenes:', ordersError);
      return;
    }

    console.log(`✅ ${orders.length} órdenes encontradas`);
    orders.forEach((order, index) => {
      console.log(`   ${index + 1}. Orden ${order.order_number} - Estado: ${order.status} - Fecha: ${new Date(order.created_at).toLocaleString()}`);
    });

    // 4. Verificar mensajes recientes
    console.log('\n4️⃣ Verificando mensajes recientes...');
    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', provider.user_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('❌ Error obteniendo mensajes:', messagesError);
      return;
    }

    console.log(`✅ ${messages.length} mensajes encontrados`);
    messages.forEach((message, index) => {
      console.log(`   ${index + 1}. ${message.message_type} - ${message.content?.substring(0, 50)}... - ${new Date(message.created_at).toLocaleString()}`);
    });

    // 5. Verificar pedidos pendientes
    console.log('\n5️⃣ Verificando pedidos pendientes...');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('provider_phone', provider.phone);

    if (pendingError) {
      console.error('❌ Error obteniendo pedidos pendientes:', pendingError);
      return;
    }

    console.log(`✅ ${pendingOrders.length} pedidos pendientes encontrados`);
    pendingOrders.forEach((pending, index) => {
      console.log(`   ${index + 1}. Orden ${pending.order_id} - Fecha: ${new Date(pending.created_at).toLocaleString()}`);
    });

    // 6. Verificar estructura de datos
    console.log('\n6️⃣ Verificando estructura de datos...');
    
    // Verificar que las órdenes tienen items
    const orderWithItems = orders.find(order => order.items && Array.isArray(order.items) && order.items.length > 0);
    if (orderWithItems) {
      console.log('✅ Orden con items encontrada:', {
        order_id: orderWithItems.id,
        items_count: orderWithItems.items.length,
        sample_item: orderWithItems.items[0]
      });
    } else {
      console.log('⚠️ No se encontraron órdenes con items');
    }

    // Verificar que los mensajes tienen user_id
    const messagesWithUserId = messages.filter(msg => msg.user_id);
    console.log(`✅ ${messagesWithUserId.length}/${messages.length} mensajes tienen user_id`);

    // 7. Resumen del estado
    console.log('\n7️⃣ RESUMEN DEL ESTADO');
    console.log('=' .repeat(30));
    console.log(`📊 Proveedores: 1 encontrado`);
    console.log(`📊 Órdenes: ${orders.length} recientes`);
    console.log(`📊 Mensajes: ${messages.length} recientes`);
    console.log(`📊 Pendientes: ${pendingOrders.length} activos`);
    
    // Verificar si hay órdenes confirmadas
    const confirmedOrders = orders.filter(order => order.status === 'confirmed');
    console.log(`📊 Órdenes confirmadas: ${confirmedOrders.length}`);
    
    // Verificar si hay mensajes de detalles enviados
    const detailMessages = messages.filter(msg => 
      msg.content && msg.content.includes('DETALLES DEL PEDIDO CONFIRMADO')
    );
    console.log(`📊 Mensajes de detalles: ${detailMessages.length}`);

    console.log('\n✅ VERIFICACIÓN COMPLETA FINALIZADA');
    console.log('\n📋 PRÓXIMOS PASOS PARA TESTING:');
    console.log('1. Crear una nueva orden en el frontend');
    console.log('2. Verificar que aparece el mensaje disparador en el chat');
    console.log('3. Responder desde WhatsApp del proveedor');
    console.log('4. Verificar que se envían los detalles automáticamente');
    console.log('5. Confirmar que no hay errores de URL en los logs de Vercel');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarFlujoCompleto();
