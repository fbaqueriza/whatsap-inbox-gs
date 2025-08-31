require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarEstructuraTablas() {
  console.log('🔍 Verificando estructura de tablas...\n');

  try {
    // 1. Verificar estructura de orders
    console.log('1️⃣ Estructura de tabla orders:');
    const { data: ordersSample, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    if (ordersError) {
      console.error('❌ Error al obtener muestra de orders:', ordersError);
    } else if (ordersSample.length > 0) {
      console.log('✅ Campos disponibles en orders:');
      Object.keys(ordersSample[0]).forEach(field => {
        console.log(`   - ${field}: ${typeof ordersSample[0][field]}`);
      });
    } else {
      console.log('⚠️ Tabla orders está vacía');
    }

    // 2. Verificar estructura de providers
    console.log('\n2️⃣ Estructura de tabla providers:');
    const { data: providersSample, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .limit(1);

    if (providersError) {
      console.error('❌ Error al obtener muestra de providers:', providersError);
    } else if (providersSample.length > 0) {
      console.log('✅ Campos disponibles en providers:');
      Object.keys(providersSample[0]).forEach(field => {
        console.log(`   - ${field}: ${typeof providersSample[0][field]}`);
      });
    } else {
      console.log('⚠️ Tabla providers está vacía');
    }

    // 3. Intentar obtener órdenes con campos básicos
    console.log('\n3️⃣ Intentando obtener órdenes con campos básicos:');
    const { data: ordersBasic, error: ordersBasicError } = await supabase
      .from('orders')
      .select('id, status, user_id, created_at')
      .limit(3);

    if (ordersBasicError) {
      console.error('❌ Error al obtener órdenes básicas:', ordersBasicError);
    } else {
      console.log(`✅ Encontradas ${ordersBasic.length} órdenes básicas:`);
      ordersBasic.forEach((order, index) => {
        console.log(`   ${index + 1}. ID: ${order.id}, Estado: ${order.status}, Usuario: ${order.user_id}`);
      });
    }

    // 4. Verificar si hay proveedores con consulta simple
    console.log('\n4️⃣ Verificando proveedores con consulta simple:');
    const { data: providersCount, error: providersCountError } = await supabase
      .from('providers')
      .select('id', { count: 'exact' });

    if (providersCountError) {
      console.error('❌ Error al contar proveedores:', providersCountError);
    } else {
      console.log(`✅ Total de proveedores: ${providersCount.length}`);
    }

  } catch (error) {
    console.error('❌ Error en la verificación de estructura:', error);
  }
}

verificarEstructuraTablas();
