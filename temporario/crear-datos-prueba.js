require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function crearDatosPrueba() {
  console.log('🧪 Creando datos de prueba...\n');

  try {
    // 1. Obtener el primer usuario
    console.log('1️⃣ Obteniendo usuario...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);

    if (usersError || !users.length) {
      console.error('❌ Error al obtener usuarios:', usersError);
      return;
    }

    const userId = users[0].id;
    console.log(`✅ Usuario seleccionado: ${users[0].email} (${userId})`);

    // 2. Crear un proveedor de prueba
    console.log('\n2️⃣ Creando proveedor de prueba...');
    const testProvider = {
      user_id: userId,
      name: 'Pizzería de Prueba',
      phone: '+5491135562673',
      email: 'pizzeria@test.com',
      address: 'Av. Corrientes 123, CABA',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newProvider, error: providerError } = await supabase
      .from('providers')
      .insert(testProvider)
      .select()
      .single();

    if (providerError) {
      console.error('❌ Error al crear proveedor:', providerError);
      return;
    }

    console.log(`✅ Proveedor creado: ${newProvider.name} (${newProvider.phone})`);

    // 3. Crear una orden de prueba
    console.log('\n3️⃣ Creando orden de prueba...');
    const testOrder = {
      user_id: userId,
      provider_id: newProvider.id,
      customer_name: 'Cliente de Prueba',
      customer_phone: '+5491112345678',
      items: JSON.stringify([
        { name: 'Pizza Margherita', quantity: 2, price: 1500 },
        { name: 'Coca Cola', quantity: 1, price: 300 }
      ]),
      total_amount: 3300,
      payment_method: 'efectivo',
      delivery_address: 'Av. Corrientes 123, CABA',
      delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mañana
      notes: 'Orden de prueba para testing de realtime',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(testOrder)
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error al crear orden:', orderError);
      return;
    }

    console.log(`✅ Orden creada: ${newOrder.id} - Estado: ${newOrder.status}`);

    // 4. Crear orden pendiente
    console.log('\n4️⃣ Creando orden pendiente...');
    const pendingOrder = {
      order_id: newOrder.id,
      provider_phone: newProvider.phone,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    const { data: newPendingOrder, error: pendingError } = await supabase
      .from('pending_orders')
      .insert(pendingOrder)
      .select()
      .single();

    if (pendingError) {
      console.error('❌ Error al crear orden pendiente:', pendingError);
      return;
    }

    console.log(`✅ Orden pendiente creada: ${newPendingOrder.id}`);

    // 5. Simular respuesta del proveedor
    console.log('\n5️⃣ Simulando respuesta del proveedor...');
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', newOrder.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar orden:', updateError);
      return;
    }

    console.log(`✅ Orden actualizada a 'confirmed': ${updatedOrder.id}`);

    console.log('\n🎉 Datos de prueba creados exitosamente!');
    console.log('📋 Resumen:');
    console.log(`   - Proveedor: ${newProvider.name} (${newProvider.phone})`);
    console.log(`   - Orden: ${newOrder.id} - Estado: ${updatedOrder.status}`);
    console.log(`   - Orden pendiente: ${newPendingOrder.id}`);
    
    console.log('\n🔍 Ahora verifica en el frontend que:');
    console.log('   - El proveedor aparece en la lista');
    console.log('   - La orden aparece con estado "confirmed"');
    console.log('   - El estado cambió inmediatamente sin refresh');
    console.log('   - No hay logs duplicados en la consola');
    console.log('   - Los mensajes aparecen en tiempo real');

  } catch (error) {
    console.error('❌ Error en la creación de datos de prueba:', error);
  }
}

crearDatosPrueba();
