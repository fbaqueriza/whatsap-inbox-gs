const { createClient } = require('@supabase/supabase-js');
// Usar fetch nativo de Node.js 18+
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testKapsoSupabaseIntegration() {
  console.log('🧪 Probando integración Kapso + Supabase...\n');

  try {
    // 1. Configurar suscripción a eventos de Kapso
    console.log('📡 Configurando suscripción a eventos de Kapso...');
    
    const ordersChannel = supabase
      .channel('orders-updates')
      .on('broadcast', { event: 'order_updated' }, (payload) => {
        console.log('🔄 Evento de orden desde Kapso recibido:', {
          orderId: payload.payload.orderId,
          status: payload.payload.status,
          timestamp: payload.payload.timestamp,
          source: payload.payload.source
        });
      })
      .subscribe((status) => {
        console.log('📡 Estado suscripción órdenes Kapso:', status);
      });

    // 2. Simular evento de Kapso enviando al endpoint
    console.log('\n🚀 Simulando evento de Kapso...');
    
    const testEvent = {
      type: 'order_update',
      payload: {
        orderId: 'bcd887df-9005-427f-9a4b-cceeded08b7f', // ID de orden real
        status: 'pendiente_de_pago',
        timestamp: new Date().toISOString(),
        source: 'kapso'
      }
    };

    const response = await fetch('http://localhost:3001/api/kapso/supabase-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEvent)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Evento enviado exitosamente:', result);
    } else {
      console.error('❌ Error enviando evento:', response.status, await response.text());
    }

    // 3. Mantener la suscripción activa por 10 segundos
    console.log('\n⏳ Manteniendo suscripción activa por 10 segundos...');
    setTimeout(() => {
      ordersChannel.unsubscribe();
      console.log('✅ Prueba completada');
    }, 10000);

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testKapsoSupabaseIntegration();
