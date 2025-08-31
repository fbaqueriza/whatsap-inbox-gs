require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

console.log('🧪 TEST DEL FLUJO DE DETALLES');
console.log('==============================');

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFlujoDetalles() {
  try {
    console.log('\n📋 1. Verificando pedidos pendientes...');
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('pending_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (pendingError) {
      console.error('❌ Error consultando pedidos pendientes:', pendingError);
      return;
    }

    console.log(`✅ ${pendingOrders.length} pedidos pendientes encontrados`);
    
    if (pendingOrders.length === 0) {
      console.log('⚠️ No hay pedidos pendientes para probar. Crea una nueva orden primero.');
      return;
    }

    // Tomar el pedido pendiente más reciente
    const pendingOrder = pendingOrders[0];
    console.log('📋 Pedido pendiente seleccionado:', {
      id: pendingOrder.id,
      order_id: pendingOrder.order_id,
      provider_phone: pendingOrder.provider_phone,
      status: pendingOrder.status,
      created_at: pendingOrder.created_at
    });

    console.log('\n📦 2. Verificando orden asociada...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', pendingOrder.order_id)
      .single();

    if (orderError || !order) {
      console.error('❌ Error consultando orden:', orderError);
      return;
    }

    console.log('✅ Orden encontrada:', {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      user_id: order.user_id
    });

    console.log('\n🧪 3. Simulando respuesta del proveedor...');
    
    // Simular el proceso que hace el webhook usando fetch directamente
    const testResponse = 'si, confirmo el pedido';
    console.log(`📱 Simulando respuesta: "${testResponse}"`);
    
    // Simular el webhook POST
    const webhookUrl = 'http://localhost:3001/api/whatsapp/webhook';
    const webhookBody = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: pendingOrder.provider_phone.replace('+', ''),
              text: { body: testResponse },
              timestamp: Math.floor(Date.now() / 1000).toString()
            }]
          }
        }]
      }]
    };

    console.log('📡 Enviando webhook simulado...');
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookBody),
      });

      const result = await response.json();
      console.log('📥 Respuesta del webhook:', result);
      
      if (response.ok) {
        console.log('✅ Webhook procesado exitosamente');
      } else {
        console.log('❌ Error en webhook:', result);
      }
    } catch (webhookError) {
      console.error('❌ Error enviando webhook:', webhookError.message);
    }

    // Esperar un momento para que se procese
    console.log('\n⏳ Esperando 3 segundos para que se procese...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🔍 4. Verificando estado final...');
    
    // Verificar que la orden se actualizó
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .single();

    if (updateError) {
      console.error('❌ Error verificando orden actualizada:', updateError);
    } else {
      console.log(`📦 Estado de la orden: ${updatedOrder.status}`);
    }

    // Verificar que el pedido pendiente se eliminó
    const { data: remainingPending, error: remainingError } = await supabase
      .from('pending_orders')
      .select('id')
      .eq('id', pendingOrder.id)
      .single();

    if (remainingError && remainingError.code === 'PGRST116') {
      console.log('✅ Pedido pendiente eliminado correctamente');
    } else if (remainingPending) {
      console.log('⚠️ Pedido pendiente aún existe');
    }

    // Verificar mensajes de detalles enviados
    const { data: detailMessages, error: detailError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', pendingOrder.provider_phone)
      .like('content', '%DETALLES DEL PEDIDO CONFIRMADO%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (detailError) {
      console.error('❌ Error verificando mensajes de detalles:', detailError);
    } else if (detailMessages && detailMessages.length > 0) {
      console.log('✅ Mensaje de detalles enviado correctamente');
      console.log('📝 Contenido:', detailMessages[0].content.substring(0, 100) + '...');
    } else {
      console.log('❌ No se encontró mensaje de detalles enviado');
    }

    console.log('\n🎯 RESUMEN DEL TEST:');
    console.log('====================');
    console.log(`📋 Pedido pendiente procesado: ${pendingOrder.id}`);
    console.log(`📦 Orden actualizada: ${order.id}`);
    console.log(`📱 Respuesta simulada: "${testResponse}"`);
    console.log(`📦 Estado final: ${updatedOrder?.status || 'N/A'}`);
    console.log(`📝 Detalles enviados: ${detailMessages && detailMessages.length > 0 ? 'SÍ' : 'NO'}`);

  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

testFlujoDetalles();
