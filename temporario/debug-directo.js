require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDirecto() {
  console.log('🔍 DEBUG DIRECTO - Verificando flujo de datos...\n');

  try {
    // 1. Verificar que podemos conectarnos
    console.log('1️⃣ Probando conexión...');
    const { data: testData, error: testError } = await supabase
      .from('orders')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error de conexión:', testError);
      return;
    }
    console.log('✅ Conexión exitosa');

    // 2. Obtener UNA orden específica que sabemos que tiene datos del modal
    console.log('\n2️⃣ Obteniendo orden con datos del modal...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        desired_delivery_date,
        desired_delivery_time,
        payment_method,
        additional_files
      `)
      .eq('id', '1748fbce-9df5-47d6-870f-d6ed9cc0e3fa') // Esta orden tiene datos del modal
      .single();

    if (ordersError) {
      console.error('❌ Error obteniendo orden:', ordersError);
      return;
    }

    console.log('📋 Orden obtenida:', {
      id: orders.id,
      order_number: orders.order_number,
      desired_delivery_date: orders.desired_delivery_date,
      desired_delivery_time: orders.desired_delivery_time,
      payment_method: orders.payment_method,
      additional_files: orders.additional_files
    });

    // 3. Simular exactamente el SELECT que hace fetchAll
    console.log('\n3️⃣ Probando SELECT de fetchAll...');
    const { data: fetchAllOrders, error: fetchAllError } = await supabase
      .from('orders')
      .select(`
        *,
        desired_delivery_date,
        desired_delivery_time,
        payment_method,
        additional_files
      `)
      .eq('user_id', 'b5a237e6-c9f9-4561-af07-a1408825ab50')
      .order('created_at', { ascending: false })
      .limit(3);

    if (fetchAllError) {
      console.error('❌ Error en fetchAll:', fetchAllError);
      return;
    }

    console.log(`✅ fetchAll retornó ${fetchAllOrders.length} órdenes`);

    // 4. Verificar que las órdenes tengan los campos del modal
    console.log('\n4️⃣ Verificando campos del modal en fetchAll:');
    fetchAllOrders.forEach((order, index) => {
      console.log(`\n   Orden ${index + 1} (${order.order_number}):`);
      console.log(`      - desired_delivery_date: ${order.desired_delivery_date || 'NULL'}`);
      console.log(`      - desired_delivery_time: ${JSON.stringify(order.desired_delivery_time) || 'NULL'}`);
      console.log(`      - payment_method: ${order.payment_method || 'NULL'}`);
      console.log(`      - additional_files: ${JSON.stringify(order.additional_files) || 'NULL'}`);
    });

    // 5. Simular mapOrderFromDb
    console.log('\n5️⃣ Aplicando mapOrderFromDb...');
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

    const mappedOrders = fetchAllOrders.map(mapOrderFromDb);

    // 6. Verificar resultado del mapeo
    console.log('\n6️⃣ Resultado del mapeo:');
    mappedOrders.forEach((order, index) => {
      console.log(`\n   Orden mapeada ${index + 1} (${order.orderNumber}):`);
      console.log(`      - desiredDeliveryDate: ${order.desiredDeliveryDate || 'undefined'}`);
      console.log(`      - desiredDeliveryTime: ${JSON.stringify(order.desiredDeliveryTime) || 'undefined'}`);
      console.log(`      - paymentMethod: ${order.paymentMethod || 'undefined'}`);
      console.log(`      - additionalFiles: ${JSON.stringify(order.additionalFiles) || 'undefined'}`);
    });

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

debugDirecto();
