require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 🔧 SIMULAR la función fetchAll del DataProvider
async function testFetchAllFlow() {
  console.log('🧪 Probando flujo completo de fetchAll...\n');

  const currentUserId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';

  try {
    // 1. Simular fetchAll del DataProvider
    console.log('1️⃣ Ejecutando fetchAll...');
    const [{ data: provs, error: provError }, { data: ords, error: ordError }, { data: stocks, error: stockError }] = await Promise.all([
      supabase.from('providers').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
      supabase.from('orders').select(`
        *,
        desired_delivery_date,
        desired_delivery_time,
        payment_method,
        additional_files
      `).eq('user_id', currentUserId).order('created_at', { ascending: false }),
      supabase.from('stock').select(`
        *,
        associated_providers
      `).eq('user_id', currentUserId).order('preferred_provider', { ascending: true }).order('created_at', { ascending: false }),
    ]);

    if (provError) console.error('❌ Error fetching providers:', provError);
    if (ordError) console.error('❌ Error fetching orders:', ordError);
    if (stockError) console.error('❌ Error fetching stock:', stockError);

    console.log(`✅ Providers: ${provs?.length || 0}`);
    console.log(`✅ Orders: ${ords?.length || 0}`);
    console.log(`✅ Stock: ${stocks?.length || 0}`);

    // 2. Verificar datos de órdenes ANTES del mapeo
    if (ords && ords.length > 0) {
      console.log('\n2️⃣ Datos de órdenes ANTES del mapeo (BD):');
      const sampleOrder = ords[0];
      console.log('📋 Orden de ejemplo:', {
        id: sampleOrder.id,
        provider_id: sampleOrder.provider_id,
        has_desired_delivery_date: !!sampleOrder.desired_delivery_date,
        desired_delivery_date: sampleOrder.desired_delivery_date,
        has_desired_delivery_time: !!sampleOrder.desired_delivery_time,
        desired_delivery_time: sampleOrder.desired_delivery_time,
        has_payment_method: !!sampleOrder.payment_method,
        payment_method: sampleOrder.payment_method,
        has_additional_files: !!sampleOrder.additional_files,
        additional_files: sampleOrder.additional_files
      });
    }

    // 3. Simular mapOrderFromDb
    console.log('\n3️⃣ Aplicando mapOrderFromDb...');
    function mapOrderFromDb(order) {
      return {
        ...order,
        providerId: order.provider_id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        orderDate: order.order_date,
        dueDate: order.due_date,
        invoiceNumber: order.invoice_number,
        bankInfo: order.bank_info,
        receiptUrl: order.receipt_url,
        // 🔧 NUEVAS COLUMNAS NATIVAS: Mapear directamente desde la BD
        desiredDeliveryDate: order.desired_delivery_date ? new Date(order.desired_delivery_date) : undefined,
        desiredDeliveryTime: order.desired_delivery_time || undefined,
        paymentMethod: (order.payment_method) || 'efectivo',
        additionalFiles: order.additional_files || undefined,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        id: order.id,
        user_id: order.user_id,
      };
    }

    const mappedOrders = (ords || []).map(mapOrderFromDb);

    // 4. Verificar datos DESPUÉS del mapeo
    if (mappedOrders && mappedOrders.length > 0) {
      console.log('\n4️⃣ Datos de órdenes DESPUÉS del mapeo:');
      const sampleMappedOrder = mappedOrders[0];
      console.log('📋 Orden mapeada de ejemplo:', {
        id: sampleMappedOrder.id,
        providerId: sampleMappedOrder.providerId,
        has_desiredDeliveryDate: !!sampleMappedOrder.desiredDeliveryDate,
        desiredDeliveryDate: sampleMappedOrder.desiredDeliveryDate,
        has_desiredDeliveryTime: !!sampleMappedOrder.desiredDeliveryTime,
        desiredDeliveryTime: sampleMappedOrder.desiredDeliveryTime,
        has_paymentMethod: !!sampleMappedOrder.paymentMethod,
        paymentMethod: sampleMappedOrder.paymentMethod,
        has_additionalFiles: !!sampleMappedOrder.additionalFiles,
        additionalFiles: sampleMappedOrder.additionalFiles
      });
    }

    // 5. Verificar órdenes con campos del modal
    console.log('\n5️⃣ Órdenes con campos del modal completos:');
    const ordersWithModalData = mappedOrders.filter(order => 
      order.desiredDeliveryDate || 
      (order.desiredDeliveryTime && order.desiredDeliveryTime.length > 0) ||
      order.paymentMethod !== 'efectivo'
    );

    console.log(`📊 Total de órdenes: ${mappedOrders.length}`);
    console.log(`📊 Órdenes con campos del modal: ${ordersWithModalData.length}`);

    if (ordersWithModalData.length > 0) {
      console.log('\n📋 Detalle de órdenes con campos del modal:');
      ordersWithModalData.forEach((order, index) => {
        console.log(`\n   ${index + 1}. Orden ${order.orderNumber}:`);
        console.log(`      - Fecha de entrega: ${order.desiredDeliveryDate || 'No especificada'}`);
        console.log(`      - Horarios: ${JSON.stringify(order.desiredDeliveryTime) || 'No especificados'}`);
        console.log(`      - Método de pago: ${order.paymentMethod || 'No especificado'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

testFetchAllFlow();
