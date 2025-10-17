// Script para probar Supabase Realtime con órdenes
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtimeOrders() {
  console.log('🔍 PROBANDO SUPABASE REALTIME CON ÓRDENES');
  console.log('==========================================');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('\n📋 Configurando suscripción a órdenes...');

  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';

  // Configurar suscripción a órdenes
  const subscription = supabase
    .channel('orders-realtime-test')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('\n🔔 EVENTO REALTIME RECIBIDO:');
        console.log('   📊 Evento:', payload.eventType);
        console.log('   🆔 ID:', payload.new?.id || payload.old?.id);
        console.log('   📋 Número:', payload.new?.order_number || payload.old?.order_number);
        console.log('   📊 Estado:', payload.new?.status || payload.old?.status);
        console.log('   💰 Monto:', payload.new?.total_amount || payload.old?.total_amount);
        console.log('   📅 Timestamp:', new Date().toISOString());
        console.log('   📝 Payload completo:', JSON.stringify(payload, null, 2));
      }
    )
    .subscribe((status) => {
      console.log('📡 Estado de suscripción:', status);
    });

  console.log('✅ Suscripción configurada');
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

testRealtimeOrders();
