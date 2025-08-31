require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtimeFix() {
  console.log('🧪 Probando correcciones de Realtime...\n');

  try {
    // 1. Verificar que hay órdenes pendientes
    console.log('1️⃣ Verificando órdenes pendientes...');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('*')
      .or('status.eq.pending,status.eq.pending_confirmation')
      .limit(5);

    if (pendingError) {
      console.error('❌ Error al obtener órdenes pendientes:', pendingError);
      return;
    }

    console.log(`✅ Encontradas ${pendingOrders.length} órdenes pendientes`);
    
    if (pendingOrders.length === 0) {
      console.log('⚠️ No hay órdenes pendientes para probar');
      return;
    }

    // 2. Simular una respuesta del proveedor (actualizar estado a confirmed)
    const testOrder = pendingOrders[0];
    console.log(`\n2️⃣ Simulando respuesta del proveedor para orden ${testOrder.id}...`);
    
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', testOrder.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar orden:', updateError);
      return;
    }

    console.log(`✅ Orden actualizada a 'confirmed': ${updatedOrder.id}`);

    // 3. Verificar que se envió el mensaje de detalles
    console.log('\n3️⃣ Verificando mensaje de detalles...');
    
    // Esperar un momento para que se procese
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: detailMessages, error: detailError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', testOrder.provider_phone)
      .gte('timestamp', new Date(Date.now() - 10000).toISOString()) // Últimos 10 segundos
      .order('timestamp', { ascending: false })
      .limit(5);

    if (detailError) {
      console.error('❌ Error al obtener mensajes de detalles:', detailError);
      return;
    }

    console.log(`✅ Encontrados ${detailMessages.length} mensajes recientes`);
    
    const detailMessage = detailMessages.find(msg => 
      msg.content && msg.content.includes('detalles') && msg.message_type === 'sent'
    );

    if (detailMessage) {
      console.log(`✅ Mensaje de detalles encontrado: ${detailMessage.id}`);
      console.log(`📝 Contenido: ${detailMessage.content.substring(0, 100)}...`);
    } else {
      console.log('⚠️ No se encontró mensaje de detalles');
    }

    // 4. Verificar que se eliminó la orden pendiente
    console.log('\n4️⃣ Verificando eliminación de orden pendiente...');
    
    const { data: remainingPending, error: remainingError } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('order_id', testOrder.id);

    if (remainingError) {
      console.error('❌ Error al verificar órdenes pendientes:', remainingError);
      return;
    }

    if (remainingPending.length === 0) {
      console.log('✅ Orden pendiente eliminada correctamente');
    } else {
      console.log(`⚠️ Orden pendiente aún existe: ${remainingPending[0].id}`);
    }

    console.log('\n🎉 Prueba completada. Verifica en el frontend que:');
    console.log('   - El estado de la orden cambió inmediatamente a "confirmed"');
    console.log('   - No hay logs duplicados en la consola');
    console.log('   - Los mensajes aparecen en tiempo real');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testRealtimeFix();
