// Script para probar Supabase Realtime SIN filtro de user_id
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtimeNoFilter() {
  console.log('🔍 PROBANDO SUPABASE REALTIME SIN FILTRO');
  console.log('=========================================');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('\n📋 Configurando suscripción a órdenes SIN filtro...');

  // Configurar suscripción a órdenes SIN filtro de user_id
  const subscription = supabase
    .channel('orders-realtime-no-filter')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders'
        // SIN FILTRO de user_id
      },
      (payload) => {
        console.log('\n🔔 EVENTO REALTIME RECIBIDO (SIN FILTRO):');
        console.log('   📊 Evento:', payload.eventType);
        console.log('   🆔 ID:', payload.new?.id || payload.old?.id);
        console.log('   👤 User ID:', payload.new?.user_id || payload.old?.user_id);
        console.log('   📋 Número:', payload.new?.order_number || payload.old?.order_number);
        console.log('   📊 Estado:', payload.new?.status || payload.old?.status);
        console.log('   💰 Monto:', payload.new?.total_amount || payload.old?.total_amount);
        console.log('   📅 Timestamp:', new Date().toISOString());
      }
    )
    .subscribe((status) => {
      console.log('📡 Estado de suscripción (SIN FILTRO):', status);
    });

  console.log('✅ Suscripción configurada SIN filtro');
  console.log('\n⏳ Esperando eventos de tiempo real...');
  console.log('   (Presiona Ctrl+C para salir)');

  // Mantener el script corriendo
  process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando suscripción...');
    subscription.unsubscribe();
    process.exit(0);
  });

  // Mantener el proceso vivo
  setInterval(() => {
    console.log('⏰ Esperando eventos...', new Date().toISOString());
  }, 30000); // Log cada 30 segundos
}

testRealtimeNoFilter();
