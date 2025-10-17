// Script para verificar el estado actual de una orden específica
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderStatus() {
  console.log('🔍 VERIFICANDO ESTADO DE ÓRDENES');
  console.log('=====================================');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('\n📋 Buscando órdenes recientes...');

  // Buscar órdenes recientes del usuario
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', 'b5a237e6-c9f9-4561-af07-a1408825ab50')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (ordersError) {
    console.error('❌ Error obteniendo órdenes:', ordersError);
    return;
  }

  console.log(`✅ Encontradas ${orders.length} órdenes recientes:`);
  
  orders.forEach((order, index) => {
    console.log(`\n📦 Orden ${index + 1}:`);
    console.log(`   🆔 ID: ${order.id}`);
    console.log(`   📋 Número: ${order.order_number}`);
    console.log(`   📊 Estado: ${order.status}`);
    console.log(`   💰 Monto: $${order.total_amount || 0}`);
    console.log(`   📄 Factura: ${order.invoice_number || 'N/A'}`);
    console.log(`   🔗 Receipt URL: ${order.receipt_url ? 'Sí' : 'No'}`);
    console.log(`   📅 Actualizado: ${order.updated_at}`);
    console.log(`   📅 Creado: ${order.created_at}`);
  });

  // Buscar específicamente la orden que se mencionó en los logs
  const specificOrderId = '11300adb-cb89-4a83-94bb-b6f824f05eaf';
  console.log(`\n🔍 Verificando orden específica: ${specificOrderId}`);
  
  const { data: specificOrder, error: specificError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', specificOrderId)
    .single();

  if (specificError) {
    console.error('❌ Error obteniendo orden específica:', specificError);
  } else if (specificOrder) {
    console.log('✅ Orden específica encontrada:');
    console.log(`   🆔 ID: ${specificOrder.id}`);
    console.log(`   📋 Número: ${specificOrder.order_number}`);
    console.log(`   📊 Estado: ${specificOrder.status}`);
    console.log(`   💰 Monto: $${specificOrder.total_amount || 0}`);
    console.log(`   📄 Factura: ${specificOrder.invoice_number || 'N/A'}`);
    console.log(`   🔗 Receipt URL: ${specificOrder.receipt_url ? 'Sí' : 'No'}`);
    console.log(`   📅 Actualizado: ${specificOrder.updated_at}`);
  } else {
    console.log('❌ Orden específica no encontrada');
  }

  console.log('\n=====================================');
}

checkOrderStatus();
