const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://qjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcWpxanFqcWpxanFqcWpxanFqcWoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5OTk5OTk5OSwiZXhwIjoyMDE1NTc1OTk5fQ.example';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSupabaseRealtime() {
  console.log('🔧 SETTING UP SUPABASE REALTIME...\n');

  try {
    // 1. Verificar que las tablas existen
    console.log('1. 📋 Verificando tablas...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['kapso_messages', 'kapso_conversations', 'kapso_contacts']);

    if (tablesError) {
      console.log('❌ Error verificando tablas:', tablesError.message);
      return;
    }

    console.log('✅ Tablas encontradas:', tables.map(t => t.table_name));

    // 2. Verificar políticas RLS existentes
    console.log('\n2. 🔐 Verificando políticas RLS...');
    
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .in('tablename', ['kapso_messages', 'kapso_conversations', 'kapso_contacts']);

    if (policiesError) {
      console.log('❌ Error verificando políticas:', policiesError.message);
    } else {
      console.log('✅ Políticas RLS encontradas:', policies.length);
      policies.forEach(policy => {
        console.log(`   - ${policy.tablename}: ${policy.policyname} (${policy.cmd})`);
      });
    }

    // 3. Verificar que Realtime esté habilitado
    console.log('\n3. 📡 Verificando configuración de Realtime...');
    
    const { data: realtimeConfig, error: realtimeError } = await supabase
      .from('pg_publication_tables')
      .select('*')
      .in('tablename', ['kapso_messages', 'kapso_conversations', 'kapso_contacts']);

    if (realtimeError) {
      console.log('❌ Error verificando Realtime:', realtimeError.message);
    } else {
      console.log('✅ Tablas en publicación Realtime:', realtimeConfig.length);
      realtimeConfig.forEach(config => {
        console.log(`   - ${config.tablename}: ${config.schemaname}`);
      });
    }

    // 4. Probar suscripción básica
    console.log('\n4. 🧪 Probando suscripción básica...');
    
    const channel = supabase
      .channel('test_realtime_setup')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kapso_messages'
        },
        (payload) => {
          console.log('📡 Evento recibido:', payload.eventType, payload);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Estado de suscripción: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción exitosa');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Error en suscripción');
        } else if (status === 'TIMED_OUT') {
          console.log('⏰ Timeout en suscripción');
        }
      });

    // Esperar un poco para ver el estado
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Limpiar suscripción
    await channel.unsubscribe();

    console.log('\n🎯 SETUP COMPLETADO');
    console.log('\n📋 Resumen:');
    console.log(`   - Tablas: ${tables.length} encontradas`);
    console.log(`   - Políticas RLS: ${policies?.length || 0} encontradas`);
    console.log(`   - Realtime: ${realtimeConfig?.length || 0} tablas configuradas`);
    console.log('\n💡 Si hay problemas:');
    console.log('   1. Verificar que Realtime esté habilitado en Supabase Dashboard');
    console.log('   2. Comprobar que las políticas RLS permitan SELECT');
    console.log('   3. Verificar que las tablas estén en la publicación Realtime');

  } catch (error) {
    console.error('❌ Error en setup:', error.message);
  }
}

setupSupabaseRealtime();
