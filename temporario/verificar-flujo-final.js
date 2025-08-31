require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

console.log('🔍 VERIFICACIÓN DEL FLUJO COMPLETO DE ÓRDENES');
console.log('============================================');

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarFlujo() {
  try {
    console.log('\n📋 1. Verificando proveedores...');
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .limit(5);

    if (providerError) {
      console.error('❌ Error consultando proveedores:', providerError);
      return;
    }

    console.log(`✅ ${providers.length} proveedores encontrados`);
    if (providers.length > 0) {
      console.log('📞 Primer proveedor:', {
        id: providers[0].id,
        name: providers[0].name,
        phone: providers[0].phone,
        user_id: providers[0].user_id
      });
    }

    console.log('\n📦 2. Verificando órdenes...');
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (orderError) {
      console.error('❌ Error consultando órdenes:', orderError);
      return;
    }

    console.log(`✅ ${orders.length} órdenes encontradas`);
    if (orders.length > 0) {
      console.log('📋 Última orden:', {
        id: orders[0].id,
        status: orders[0].status,
        user_id: orders[0].user_id,
        created_at: orders[0].created_at
      });
    }

    console.log('\n💬 3. Verificando mensajes de WhatsApp...');
    const { data: messages, error: messageError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (messageError) {
      console.error('❌ Error consultando mensajes:', messageError);
      return;
    }

    console.log(`✅ ${messages.length} mensajes encontrados`);
    
    const sentMessages = messages.filter(m => m.message_type === 'sent');
    const receivedMessages = messages.filter(m => m.message_type === 'received');
    
    console.log(`📤 Mensajes enviados: ${sentMessages.length}`);
    console.log(`📥 Mensajes recibidos: ${receivedMessages.length}`);

    if (messages.length > 0) {
      console.log('💬 Último mensaje:', {
        id: messages[0].id,
        content: messages[0].content?.substring(0, 50) + '...',
        message_type: messages[0].message_type,
        contact_id: messages[0].contact_id,
        user_id: messages[0].user_id,
        created_at: messages[0].created_at
      });
    }

    console.log('\n⏳ 4. Verificando pedidos pendientes...');
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
    if (pendingOrders.length > 0) {
      console.log('⏳ Pedido pendiente más reciente:', {
        id: pendingOrders[0].id,
        order_id: pendingOrders[0].order_id,
        provider_phone: pendingOrders[0].provider_phone,
        status: pendingOrders[0].status,
        created_at: pendingOrders[0].created_at
      });
    }

    console.log('\n🔍 5. Análisis del flujo...');
    
    // Verificar si hay órdenes confirmadas
    const confirmedOrders = orders.filter(o => o.status === 'confirmed');
    console.log(`✅ Órdenes confirmadas: ${confirmedOrders.length}`);
    
    // Verificar si hay mensajes de disparador (templates)
    const triggerMessages = messages.filter(m => 
      m.content && m.content.includes('envio_de_orden')
    );
    console.log(`📤 Mensajes disparador enviados: ${triggerMessages.length}`);
    
    // Verificar si hay mensajes de detalles
    const detailMessages = messages.filter(m => 
      m.content && (
        m.content.includes('Método de pago:') || 
        m.content.includes('Fecha de entrega:') ||
        m.content.includes('Detalles del pedido:')
      )
    );
    console.log(`📋 Mensajes de detalles enviados: ${detailMessages.length}`);

    console.log('\n💡 RECOMENDACIONES:');
    if (pendingOrders.length > 0) {
      console.log('⚠️ Hay pedidos pendientes. Para completar el flujo:');
      console.log('   1. Responde al mensaje disparador desde WhatsApp');
      console.log('   2. Verifica que el estado cambie a "confirmado"');
      console.log('   3. Verifica que se envíen los detalles automáticamente');
    } else {
      console.log('✅ No hay pedidos pendientes. El flujo está limpio.');
    }

    if (triggerMessages.length === 0) {
      console.log('⚠️ No se encontraron mensajes disparador. Crea una nueva orden para probar.');
    }

    if (detailMessages.length === 0 && confirmedOrders.length > 0) {
      console.log('⚠️ Hay órdenes confirmadas pero no se enviaron detalles. Revisa los logs de Vercel.');
    }

    console.log('\n🎯 Para probar el flujo completo:');
    console.log('1. Crea una nueva orden en el frontend');
    console.log('2. Verifica que aparezca el mensaje disparador en el chat');
    console.log('3. Responde desde WhatsApp del proveedor');
    console.log('4. Verifica que el estado cambie a "confirmado"');
    console.log('5. Verifica que se envíen los detalles automáticamente');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarFlujo();
