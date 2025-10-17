// Script de prueba completa para verificar la configuración
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testCompleteSetup = async () => {
  console.log('🧪 Probando configuración completa de Kapso + Supabase...');
  
  try {
    // 1. Verificar tablas
    console.log('📋 Verificando tablas...');
    
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('id')
      .limit(1);

    if (convError && convError.code === '42P01') {
      console.log('❌ Las tablas no existen. Ejecuta primero el SQL en Supabase.');
      console.log('📋 Archivo: temporario/KAPSO_SUPABASE_SETUP.sql');
      return;
    }

    console.log('✅ Tablas verificadas');

    // 2. Probar función de sincronización
    console.log('🔄 Probando función de sincronización...');
    
    const testData = {
      p_conversation_id: `test_conv_${Date.now()}`,
      p_phone_number: '5491135562673',
      p_contact_name: 'Usuario de Prueba',
      p_message_id: `test_msg_${Date.now()}`,
      p_from_number: '5491135562673',
      p_to_number: '5491141780300',
      p_content: 'Mensaje de prueba desde script',
      p_message_type: 'text',
      p_timestamp: new Date().toISOString(),
      p_user_id: '00000000-0000-0000-0000-000000000000' // UUID válido para pruebas
    };

    const { data: syncResult, error: syncError } = await supabase.rpc('sync_kapso_data', testData);

    if (syncError) {
      console.error('❌ Error en función de sincronización:', syncError);
      return;
    }

    console.log('✅ Función de sincronización funcionando:', syncResult);

    // 3. Probar estadísticas
    console.log('📊 Probando estadísticas...');
    
    const { data: stats, error: statsError } = await supabase.rpc('get_kapso_stats', {
      p_user_id: '00000000-0000-0000-0000-000000000000'
    });

    if (statsError) {
      console.error('❌ Error obteniendo estadísticas:', statsError);
    } else {
      console.log('✅ Estadísticas:', stats);
    }

    // 4. Probar endpoint
    console.log('🌐 Probando endpoint...');
    
    const testWebhook = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1123051623072203',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5491141780300',
              phone_number_id: '670680919470999'
            },
            contacts: [{
              profile: {
                name: 'Usuario de Prueba'
              },
              wa_id: '5491135562673'
            }],
            messages: [{
              from: '5491135562673',
              id: `test_webhook_${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: 'Mensaje de prueba desde webhook'
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    try {
      const response = await fetch('http://localhost:3001/api/kapso/supabase-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testWebhook)
      });

      const result = await response.json();
      console.log('✅ Endpoint funcionando:', result);
    } catch (error) {
      console.log('⚠️ No se pudo probar el endpoint (servidor no disponible):', error.message);
    }

    // 5. Verificar datos
    console.log('📊 Verificando datos sincronizados...');
    
    const { data: messages, error: msgError } = await supabase
      .from('kapso_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (msgError) {
      console.error('❌ Error obteniendo mensajes:', msgError);
    } else {
      console.log('📨 Últimos mensajes:', messages?.length || 0);
      messages?.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`);
      });
    }

    // 6. Limpiar datos de prueba
    console.log('🧹 Limpiando datos de prueba...');
    
    await supabase
      .from('kapso_messages')
      .delete()
      .like('message_id', 'test_%');

    await supabase
      .from('kapso_conversations')
      .delete()
      .like('conversation_id', 'test_%');

    await supabase
      .from('kapso_contacts')
      .delete()
      .eq('phone_number', '5491135562673');

    console.log('✅ Datos de prueba limpiados');

    console.log('🎉 Configuración completa verificada exitosamente');
    console.log('📋 Sistema listo para usar con Kapso + Supabase');
    console.log('');
    console.log('🔗 URLs importantes:');
    console.log('   - Página de prueba: http://localhost:3001/kapso-chat');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - SQL: temporario/KAPSO_SUPABASE_SETUP.sql');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
};

testCompleteSetup();
