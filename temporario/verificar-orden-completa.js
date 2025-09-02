require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarOrdenCompleta() {
  console.log('🔍 Verificando orden completa en la base de datos...\n');

  try {
    // 1. Obtener la orden más reciente
    console.log('1️⃣ Obteniendo orden más reciente...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        desired_delivery_date,
        desired_delivery_time,
        payment_method,
        additional_files
      `)
      .order('created_at', { ascending: false })
      .limit(1);

    if (ordersError) {
      console.error('❌ Error obteniendo órdenes:', ordersError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('ℹ️ No hay órdenes en la base de datos');
      return;
    }

    const order = orders[0];
    console.log('✅ Orden encontrada:', order.id);

    // 2. Verificar estructura completa
    console.log('\n2️⃣ Verificando estructura de la orden:');
    console.log('📋 Campos básicos:');
    console.log(`   - ID: ${order.id}`);
    console.log(`   - Provider ID: ${order.provider_id}`);
    console.log(`   - Status: ${order.status}`);
    console.log(`   - Items: ${order.items?.length || 0} items`);
    console.log(`   - Notes: "${order.notes}"`);

    console.log('\n📅 Campos del modal:');
    console.log(`   - Desired Delivery Date: ${order.desired_delivery_date || 'NULL'}`);
    console.log(`   - Desired Delivery Time: ${JSON.stringify(order.desired_delivery_time) || 'NULL'}`);
    console.log(`   - Payment Method: ${order.payment_method || 'NULL'}`);
    console.log(`   - Additional Files: ${JSON.stringify(order.additional_files) || 'NULL'}`);

    // 3. Verificar que los campos del modal estén presentes
    console.log('\n3️⃣ Verificación de campos del modal:');
    const hasDeliveryDate = !!order.desired_delivery_date;
    const hasDeliveryTime = !!order.desired_delivery_time;
    const hasPaymentMethod = !!order.payment_method;
    const hasAdditionalFiles = !!order.additional_files;

    console.log(`   ✅ Desired Delivery Date: ${hasDeliveryDate ? 'PRESENTE' : 'FALTANTE'}`);
    console.log(`   ✅ Desired Delivery Time: ${hasDeliveryTime ? 'PRESENTE' : 'FALTANTE'}`);
    console.log(`   ✅ Payment Method: ${hasPaymentMethod ? 'PRESENTE' : 'FALTANTE'}`);
    console.log(`   ✅ Additional Files: ${hasAdditionalFiles ? 'PRESENTE' : 'FALTANTE'}`);

    // 4. Resumen
    const totalFields = 4;
    const presentFields = [hasDeliveryDate, hasDeliveryTime, hasPaymentMethod, hasAdditionalFiles].filter(Boolean).length;
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`   - Campos del modal presentes: ${presentFields}/${totalFields}`);
    console.log(`   - Porcentaje de completitud: ${Math.round((presentFields / totalFields) * 100)}%`);

    if (presentFields === totalFields) {
      console.log('🎉 ¡TODOS los campos del modal están presentes!');
    } else {
      console.log('⚠️ Algunos campos del modal están faltando');
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

verificarOrdenCompleta();
