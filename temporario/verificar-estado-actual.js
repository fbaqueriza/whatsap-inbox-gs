require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

console.log('🔍 VERIFICACIÓN DEL ESTADO ACTUAL DEL FLUJO');
console.log('===========================================');

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarEstadoActual() {
  try {
    console.log('\n📋 1. Verificando proveedores...');
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .limit(3);

    if (providerError) {
      console.error('❌ Error consultando proveedores:', providerError);
      return;
    }

    console.log(`✅ ${providers.length} proveedores encontrados`);
    if (providers.length > 0) {
      providers.forEach((provider, index) => {
        console.log(`   ${index + 1}. ${provider.name} - ${provider.phone} (user_id: ${provider.user_id})`);
      });
    }

    console.log('\n📦 2. Verificando órdenes recientes...');
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
      orders.forEach((order, index) => {
        console.log(`   ${index + 1}. ID: ${order.id} - Estado: ${order.status} - Creada: ${order.created_at}`);
      });
    }

    console.log('\n💬 3. Verificando mensajes de WhatsApp recientes...');
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
      console.log('\n📝 Últimos mensajes:');
      messages.slice(0, 5).forEach((message, index) => {
        const content = message.content ? message.content.substring(0, 50) + '...' : 'Sin contenido';
        console.log(`   ${index + 1}. [${message.message_type}] ${message.contact_id}: ${content}`);
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
      pendingOrders.forEach((pending, index) => {
        console.log(`   ${index + 1}. Order ID: ${pending.order_id} - Provider: ${pending.provider_phone} - Creado: ${pending.created_at}`);
      });
    }

    console.log('\n🔍 5. Análisis del problema...');
    
    // Verificar si hay órdenes confirmadas sin detalles enviados
    const confirmedOrders = orders.filter(o => o.status === 'confirmed');
    console.log(`✅ Órdenes confirmadas: ${confirmedOrders.length}`);
    
    // Verificar mensajes de disparador
    const triggerMessages = messages.filter(m => 
      m.content && m.content.includes('envio_de_orden')
    );
    console.log(`📤 Mensajes disparador enviados: ${triggerMessages.length}`);
    
    // Verificar mensajes de detalles
    const detailMessages = messages.filter(m => 
      m.content && (
        m.content.includes('Método de pago:') || 
        m.content.includes('Fecha de entrega:') ||
        m.content.includes('Detalles del pedido:')
      )
    );
    console.log(`📋 Mensajes de detalles enviados: ${detailMessages.length}`);

    // Verificar si hay pedidos pendientes con órdenes confirmadas
    if (pendingOrders.length > 0 && confirmedOrders.length > 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO:');
      console.log('   - Hay pedidos pendientes pero también órdenes confirmadas');
      console.log('   - Esto indica que el proceso de confirmación no está eliminando los pedidos pendientes');
      console.log('   - O que los detalles no se están enviando correctamente');
    }

    if (confirmedOrders.length > 0 && detailMessages.length === 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO:');
      console.log('   - Hay órdenes confirmadas pero no se enviaron detalles');
      console.log('   - Esto indica que processProviderResponse no está funcionando correctamente');
    }

    console.log('\n💡 DIAGNÓSTICO:');
    console.log('1. Si hay pedidos pendientes, responde desde WhatsApp para probar el flujo');
    console.log('2. Si no hay pedidos pendientes pero tampoco detalles, hay un problema en processProviderResponse');
    console.log('3. Verifica los logs de Vercel para ver si hay errores de URL o SyntaxError');

    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('1. Crear una nueva orden en el frontend');
    console.log('2. Verificar que aparezca el mensaje disparador en el chat');
    console.log('3. Responder desde WhatsApp del proveedor');
    console.log('4. Verificar que el estado cambie inmediatamente a "confirmado"');
    console.log('5. Verificar que se envíen los detalles automáticamente');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarEstadoActual();
