require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarOrdenesLigiene() {
  try {
    console.log('🔍 Verificando órdenes de L\'igiene...\n');
    
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, provider_id, created_at')
      .eq('provider_id', '4e0c6eec-dee9-4cea-ad9b-d2476fb30409')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 Últimas órdenes de L\'igiene:');
    data.forEach(order => {
      console.log(`   - ${order.order_number}: ${order.status} (${order.created_at})`);
    });
    
    // Verificar si hay órdenes confirmadas
    const confirmedOrders = data.filter(order => order.status === 'confirmed');
    console.log(`\n✅ Órdenes confirmadas: ${confirmedOrders.length}`);
    
    if (confirmedOrders.length > 0) {
      console.log('💡 Esto explica por qué recibiste el mensaje de detalles del pedido');
    } else {
      console.log('💡 No hay órdenes confirmadas - el mensaje debe ser de otra fuente');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

verificarOrdenesLigiene();
