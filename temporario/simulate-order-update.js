// Script para simular una actualización de orden y probar tiempo real
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateOrderUpdate() {
  console.log('🔍 SIMULANDO ACTUALIZACIÓN DE ORDEN');
  console.log('===================================');
  console.log('⏰ Timestamp:', new Date().toISOString());

  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';
  const orderId = '11300adb-cb89-4a83-94bb-b6f824f05eaf';

  console.log('\n📋 Obteniendo orden actual...');
  
  // Obtener la orden actual
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError) {
    console.error('❌ Error obteniendo orden:', fetchError);
    return;
  }

  console.log('✅ Orden actual:');
  console.log(`   🆔 ID: ${currentOrder.id}`);
  console.log(`   📋 Número: ${currentOrder.order_number}`);
  console.log(`   📊 Estado: ${currentOrder.status}`);
  console.log(`   💰 Monto: $${currentOrder.total_amount || 0}`);
  console.log(`   📅 Actualizado: ${currentOrder.updated_at}`);

  console.log('\n🔄 Simulando actualización de orden...');
  
  // Simular una actualización menor (cambiar updated_at)
  const newTimestamp = new Date().toISOString();
  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      updated_at: newTimestamp,
      // Agregar un campo de prueba para forzar la actualización
      notes: `Prueba de tiempo real - ${newTimestamp}`
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error actualizando orden:', updateError);
    return;
  }

  console.log('✅ Orden actualizada:');
  console.log(`   🆔 ID: ${updatedOrder.id}`);
  console.log(`   📋 Número: ${updatedOrder.order_number}`);
  console.log(`   📊 Estado: ${updatedOrder.status}`);
  console.log(`   💰 Monto: $${updatedOrder.total_amount || 0}`);
  console.log(`   📅 Actualizado: ${updatedOrder.updated_at}`);
  console.log(`   📝 Notas: ${updatedOrder.notes}`);

  console.log('\n⏳ Esperando 5 segundos para ver si se dispara el evento de tiempo real...');
  
  // Esperar 5 segundos
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n✅ Simulación completada');
  console.log('   Si el script de tiempo real está corriendo, deberías ver un evento de actualización');
}

simulateOrderUpdate();
