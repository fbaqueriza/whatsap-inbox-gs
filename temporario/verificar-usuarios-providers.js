require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarUsuariosProviders() {
  console.log('🔍 Verificando usuarios y proveedores...\n');

  try {
    // 1. Verificar usuarios
    console.log('1️⃣ Usuarios en la base de datos:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .limit(10);

    if (usersError) {
      console.error('❌ Error al obtener usuarios:', usersError);
      return;
    }

    if (users.length === 0) {
      console.log('⚠️ No hay usuarios en la base de datos');
    } else {
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.id})`);
      });
    }

    // 2. Verificar proveedores
    console.log('\n2️⃣ Proveedores en la base de datos:');
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, name, phone, user_id, created_at')
      .limit(10);

    if (providersError) {
      console.error('❌ Error al obtener proveedores:', providersError);
      return;
    }

    if (providers.length === 0) {
      console.log('⚠️ No hay proveedores en la base de datos');
    } else {
      providers.forEach((provider, index) => {
        console.log(`   ${index + 1}. ${provider.name} (${provider.phone}) - Usuario: ${provider.user_id}`);
      });
    }

    // 3. Verificar órdenes existentes
    console.log('\n3️⃣ Órdenes existentes:');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status, user_id, provider_phone, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersError) {
      console.error('❌ Error al obtener órdenes:', ordersError);
      return;
    }

    if (orders.length === 0) {
      console.log('⚠️ No hay órdenes en la base de datos');
    } else {
      orders.forEach((order, index) => {
        console.log(`   ${index + 1}. Orden ${order.id} - Estado: ${order.status} - Usuario: ${order.user_id}`);
      });
    }

    // 4. Verificar órdenes pendientes
    console.log('\n4️⃣ Órdenes pendientes:');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('id, order_id, provider_phone, user_id, created_at')
      .limit(5);

    if (pendingError) {
      console.error('❌ Error al obtener órdenes pendientes:', pendingError);
      return;
    }

    if (pendingOrders.length === 0) {
      console.log('⚠️ No hay órdenes pendientes');
    } else {
      pendingOrders.forEach((pending, index) => {
        console.log(`   ${index + 1}. Pendiente ${pending.id} - Orden: ${pending.order_id} - Proveedor: ${pending.provider_phone}`);
      });
    }

    console.log('\n📊 Resumen:');
    console.log(`   - Usuarios: ${users.length}`);
    console.log(`   - Proveedores: ${providers.length}`);
    console.log(`   - Órdenes totales: ${orders.length}`);
    console.log(`   - Órdenes pendientes: ${pendingOrders.length}`);

  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
}

verificarUsuariosProviders();
