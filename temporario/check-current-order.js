// Script para verificar el estado actual de la orden específica
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentOrder() {
  console.log('🔍 VERIFICANDO ESTADO ACTUAL DE LA ORDEN');
  console.log('==========================================');
  console.log('⏰ Timestamp:', new Date().toISOString());

  const orderId = '82a11f73-3d13-437d-9711-3b032f5e932b';
  const orderNumber = 'ORD-251015-UPG8';

  console.log(`\n📋 Verificando orden: ${orderNumber} (${orderId})`);
  
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) {
    console.error('❌ Error obteniendo orden:', orderError);
    return;
  }

  if (order) {
    console.log('✅ Orden encontrada:');
    console.log(`   🆔 ID: ${order.id}`);
    console.log(`   📋 Número: ${order.order_number}`);
    console.log(`   📊 Estado: ${order.status}`);
    console.log(`   💰 Monto: $${order.total_amount || 0}`);
    console.log(`   📄 Factura: ${order.invoice_number || 'N/A'}`);
    console.log(`   🔗 Receipt URL: ${order.receipt_url ? 'Sí' : 'No'}`);
    console.log(`   📅 Actualizado: ${order.updated_at}`);
    console.log(`   📅 Creado: ${order.created_at}`);
    
    // Verificar si hay documentos asociados
    console.log('\n📎 Verificando documentos asociados...');
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('order_id', orderId);

    if (docsError) {
      console.error('❌ Error obteniendo documentos:', docsError);
    } else {
      console.log(`✅ Encontrados ${documents.length} documentos asociados:`);
      documents.forEach((doc, index) => {
        console.log(`   📄 Documento ${index + 1}:`);
        console.log(`      🆔 ID: ${doc.id}`);
        console.log(`      📁 Nombre: ${doc.filename}`);
        console.log(`      🔗 URL: ${doc.file_url ? 'Sí' : 'No'}`);
        console.log(`      📅 Creado: ${doc.created_at}`);
      });
    }
  } else {
    console.log('❌ Orden no encontrada');
  }

  console.log('\n==========================================');
}

checkCurrentOrder();
