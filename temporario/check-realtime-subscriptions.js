// Script para verificar el estado de las suscripciones de Supabase Realtime
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const checkRealtimeSubscriptions = async () => {
  console.log('🔍 Verificando suscripciones de Supabase Realtime...');
  
  try {
    // Suscribirse a eventos de mensajes
    const messagesChannel = supabase
      .channel('messages-updates')
      .on('broadcast', { event: 'message_received' }, (payload) => {
        console.log('📨 Evento de mensaje recibido:', payload);
      })
      .subscribe((status) => {
        console.log('📡 Estado suscripción mensajes:', status);
      });

    // Suscribirse a eventos de órdenes
    const ordersChannel = supabase
      .channel('orders-updates')
      .on('broadcast', { event: 'order_updated' }, (payload) => {
        console.log('🔄 Evento de orden recibido:', payload);
      })
      .subscribe((status) => {
        console.log('📡 Estado suscripción órdenes:', status);
      });

    // Esperar un poco para que se establezcan las suscripciones
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enviar un evento de prueba
    console.log('🧪 Enviando evento de prueba...');
    const { error } = await supabase
      .channel('messages-updates')
      .send({
        type: 'broadcast',
        event: 'message_received',
        payload: {
          messageId: 'test_' + Date.now(),
          content: 'Mensaje de prueba',
          timestamp: new Date().toISOString()
        }
      });

    if (error) {
      console.error('❌ Error enviando evento:', error);
    } else {
      console.log('✅ Evento enviado exitosamente');
    }

    // Esperar un poco más para ver si se recibe el evento
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🏁 Prueba completada');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
};

checkRealtimeSubscriptions();
