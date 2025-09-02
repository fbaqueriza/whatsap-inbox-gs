require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarMigracion() {
  console.log('🔍 Verificando migración a columnas nativas...\n');

  try {
    // 1. Verificar que las nuevas columnas existen
    console.log('1️⃣ Verificando estructura de la tabla orders...');
    const { data: ordersSample, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    if (ordersError) {
      console.error('❌ Error al consultar orders:', ordersError);
      return;
    }

    if (ordersSample && ordersSample.length > 0) {
      const order = ordersSample[0];
      const hasNewColumns = [
        'desired_delivery_date' in order,
        'desired_delivery_time' in order,
        'payment_method' in order,
        'additional_files' in order
      ];

      console.log('✅ Columnas nuevas encontradas:');
      console.log(`   - desired_delivery_date: ${hasNewColumns[0] ? '✅' : '❌'}`);
      console.log(`   - desired_delivery_time: ${hasNewColumns[1] ? '✅' : '❌'}`);
      console.log(`   - payment_method: ${hasNewColumns[2] ? '✅' : '❌'}`);
      console.log(`   - additional_files: ${hasNewColumns[3] ? '✅' : '❌'}`);

      if (!hasNewColumns.every(Boolean)) {
        console.log('\n⚠️ Algunas columnas nuevas no están disponibles.');
        console.log('   Ejecuta primero el script SQL de migración de columnas.');
        return;
      }
    }

    // 2. Verificar datos migrados
    console.log('\n2️⃣ Verificando datos migrados...');
    const { data: migratedOrders, error: migratedError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        notes,
        desired_delivery_date,
        desired_delivery_time,
        payment_method,
        additional_files,
        created_at
      `)
      .or('desired_delivery_date.not.is.null,desired_delivery_time.not.is.null,payment_method.neq.efectivo,additional_files.not.is.null')
      .order('created_at', { ascending: false })
      .limit(5);

    if (migratedError) {
      console.error('❌ Error al consultar órdenes migradas:', migratedError);
      return;
    }

    if (migratedOrders && migratedOrders.length > 0) {
      console.log(`✅ Encontradas ${migratedOrders.length} órdenes con datos migrados:`);
      migratedOrders.forEach((order, index) => {
        console.log(`\n   ${index + 1}. Orden: ${order.order_number}`);
        console.log(`      - Fecha de entrega: ${order.desired_delivery_date || 'No especificada'}`);
        console.log(`      - Horarios: ${order.desired_delivery_time ? order.desired_delivery_time.join(', ') : 'No especificados'}`);
        console.log(`      - Método de pago: ${order.payment_method || 'efectivo'}`);
        console.log(`      - Archivos: ${order.additional_files ? 'Sí' : 'No'}`);
        if (order.notes && order.notes.includes('📅')) {
          console.log(`      - ⚠️ Notas aún contienen información del modal`);
        }
      });
    } else {
      console.log('⚠️ No se encontraron órdenes con datos migrados.');
      console.log('   Esto puede indicar que:');
      console.log('   1. No hay órdenes con información del modal');
      console.log('   2. La migración no se ha ejecutado aún');
      console.log('   3. Las columnas no están disponibles');
    }

    // 3. Verificar estadísticas generales
    console.log('\n3️⃣ Estadísticas generales...');
    const { data: stats, error: statsError } = await supabase
      .from('orders')
      .select('*', { count: 'exact' });

    if (statsError) {
      console.error('❌ Error al obtener estadísticas:', statsError);
      return;
    }

    const totalOrders = stats?.length || 0;
    const ordersWithDeliveryDate = migratedOrders?.filter(o => o.desired_delivery_date).length || 0;
    const ordersWithDeliveryTime = migratedOrders?.filter(o => o.desired_delivery_time).length || 0;
    const ordersWithCustomPayment = migratedOrders?.filter(o => o.payment_method !== 'efectivo').length || 0;
    const ordersWithFiles = migratedOrders?.filter(o => o.additional_files).length || 0;

    console.log(`📊 Total de órdenes: ${totalOrders}`);
    console.log(`📅 Órdenes con fecha de entrega: ${ordersWithDeliveryDate}`);
    console.log(`⏰ Órdenes con horarios: ${ordersWithDeliveryTime}`);
    console.log(`💳 Órdenes con método de pago personalizado: ${ordersWithCustomPayment}`);
    console.log(`📎 Órdenes con archivos: ${ordersWithFiles}`);

    // 4. Recomendaciones
    console.log('\n4️⃣ Recomendaciones:');
    if (ordersWithDeliveryDate > 0 || ordersWithDeliveryTime > 0 || ordersWithCustomPayment > 0 || ordersWithFiles > 0) {
      console.log('✅ La migración parece estar funcionando correctamente.');
      console.log('   Los datos del modal ahora se almacenan en columnas nativas.');
    } else {
      console.log('⚠️ No se detectaron datos migrados.');
      console.log('   Ejecuta el script de migración de datos si tienes órdenes existentes.');
    }

    console.log('\n🎯 Próximos pasos:');
    console.log('   1. Verifica que la aplicación funcione correctamente');
    console.log('   2. Crea una nueva orden para probar las columnas nativas');
    console.log('   3. Opcional: Limpia las notas antiguas después de verificar');

  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
}

verificarMigracion();
