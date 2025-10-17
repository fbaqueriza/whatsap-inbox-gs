// Script para probar si el frontend recibe eventos de Supabase Realtime
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testRealtimeBroadcast = async () => {
  console.log('🧪 Probando broadcast a Supabase Realtime...');
  
  try {
    // Probar broadcast a canal de mensajes
    const { error: messageError } = await supabase
      .channel('messages-updates')
      .send({
        type: 'broadcast',
        event: 'message_received',
        payload: {
          messageId: 'test_msg_' + Date.now(),
          content: 'Mensaje de prueba desde script',
          from: '5491135562673',
          timestamp: new Date().toISOString(),
          source: 'test_script'
        }
      });

    if (messageError) {
      console.error('❌ Error enviando evento de mensaje:', messageError);
    } else {
      console.log('✅ Evento de mensaje enviado exitosamente');
    }

    // Probar broadcast a canal de órdenes
    const { error: orderError } = await supabase
      .channel('orders-updates')
      .send({
        type: 'broadcast',
        event: 'order_updated',
        payload: {
          orderId: 'test_order_' + Date.now(),
          status: 'enviado',
          timestamp: new Date().toISOString(),
          source: 'test_script'
        }
      });

    if (orderError) {
      console.error('❌ Error enviando evento de orden:', orderError);
    } else {
      console.log('✅ Evento de orden enviado exitosamente');
    }

    console.log('🎉 Prueba de broadcast completada');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
};

testRealtimeBroadcast();
