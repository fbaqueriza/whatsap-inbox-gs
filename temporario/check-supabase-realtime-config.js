const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseRealtimeConfig() {
  console.log('🔍 Verificando configuración de Supabase Realtime...\n');

  try {
    // 1. Verificar que las tablas existan
    console.log('📋 Verificando tablas...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables_info');

    if (tablesError) {
      console.log('ℹ️ Usando método alternativo para verificar tablas...');
      // Método alternativo: intentar hacer una consulta simple a cada tabla
      try {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('id')
          .limit(1);
        
        if (!ordersError) {
          console.log('✅ Tabla "orders" existe');
        } else {
          console.log('❌ Tabla "orders" no existe o no accesible:', ordersError.message);
        }

        const { data: messagesData, error: messagesError } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .limit(1);
        
        if (!messagesError) {
          console.log('✅ Tabla "whatsapp_messages" existe');
        } else {
          console.log('❌ Tabla "whatsapp_messages" no existe o no accesible:', messagesError.message);
        }
      } catch (error) {
        console.error('❌ Error verificando tablas:', error);
      }
    } else {
      console.log('✅ Tablas encontradas:', tables);
    }

    // 2. Verificar políticas RLS (método simplificado)
    console.log('\n🔒 Verificando políticas RLS...');
    console.log('ℹ️ Verificando acceso a tablas con RLS...');
    
    // Probar acceso a orders
    const { data: ordersTest, error: ordersTestError } = await supabase
      .from('orders')
      .select('id, status, user_id')
      .limit(1);
    
    if (ordersTestError) {
      console.log('❌ Error accediendo a orders:', ordersTestError.message);
    } else {
      console.log('✅ Acceso a orders OK');
    }

    // Probar acceso a whatsapp_messages
    const { data: messagesTest, error: messagesTestError } = await supabase
      .from('whatsapp_messages')
      .select('id, content, user_id')
      .limit(1);
    
    if (messagesTestError) {
      console.log('❌ Error accediendo a whatsapp_messages:', messagesTestError.message);
    } else {
      console.log('✅ Acceso a whatsapp_messages OK');
    }

    // 3. Verificar configuración de Realtime
    console.log('\n⚡ Verificando configuración de Realtime...');
    console.log('ℹ️ Probando suscripción de Realtime...');

    // 4. Probar suscripción de prueba
    console.log('\n🧪 Probando suscripción de prueba...');
    const testChannel = supabase
      .channel('test-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        console.log('📡 Evento Realtime recibido:', {
          event: payload.eventType,
          table: payload.table,
          new: payload.new ? { id: payload.new.id, status: payload.new.status } : null,
          old: payload.old ? { id: payload.old.id, status: payload.old.status } : null
        });
      })
      .subscribe((status) => {
        console.log('📡 Estado de suscripción:', status);
      });

    // Mantener la suscripción por 10 segundos
    setTimeout(() => {
      testChannel.unsubscribe();
      console.log('✅ Prueba de suscripción completada');
    }, 10000);

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

checkSupabaseRealtimeConfig();
