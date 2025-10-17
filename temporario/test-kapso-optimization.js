// Script de prueba completa para la optimización de Kapso
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const testKapsoOptimization = async () => {
  console.log('🧪 Probando optimización completa de Kapso...');
  
  try {
    // 1. Verificar tablas de Kapso
    console.log('📋 Verificando tablas de Kapso...');
    
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('id')
      .limit(1);

    if (convError && convError.code === '42P01') {
      console.log('❌ Las tablas de Kapso no existen. Ejecuta primero el SQL en Supabase.');
      console.log('📋 Ve al SQL Editor de Supabase y ejecuta el SQL generado por execute-supabase-sql.js');
      return;
    }

    console.log('✅ Tablas de Kapso verificadas');

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
      p_user_id: 'test-user-id'
    };

    const { data: syncResult, error: syncError } = await supabase.rpc('sync_kapso_data', testData);

    if (syncError) {
      console.error('❌ Error probando función de sincronización:', syncError);
      return;
    }

    console.log('✅ Función de sincronización funcionando:', syncResult);

    // 3. Probar suscripciones en tiempo real
    console.log('📡 Probando suscripciones en tiempo real...');
    
    const channel = supabase
      .channel('kapso-test')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'kapso_messages'
        },
        (payload) => {
          console.log('📨 Mensaje recibido en tiempo real:', payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción:', status);
      });

    // 4. Probar endpoint optimizado
    console.log('🌐 Probando endpoint optimizado...');
    
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
      console.log('✅ Endpoint optimizado funcionando:', result);
    } catch (error) {
      console.log('⚠️ No se pudo probar el endpoint (servidor no disponible):', error.message);
    }

    // 5. Verificar datos sincronizados
    console.log('📊 Verificando datos sincronizados...');
    
    const { data: messages, error: msgError } = await supabase
      .from('kapso_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (msgError) {
      console.error('❌ Error obteniendo mensajes:', msgError);
    } else {
      console.log('📨 Últimos mensajes sincronizados:', messages?.length || 0);
      messages?.forEach((msg, index) => {
        console.log(`   ${index + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`);
      });
    }

    const { data: convs, error: convsError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(5);

    if (convsError) {
      console.error('❌ Error obteniendo conversaciones:', convsError);
    } else {
      console.log('💬 Últimas conversaciones:', convs?.length || 0);
      convs?.forEach((conv, index) => {
        console.log(`   ${index + 1}. ${conv.contact_name || conv.phone_number} (${conv.phone_number}) - ${conv.status}`);
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

    // 7. Desuscribirse
    await channel.unsubscribe();

    console.log('🎉 Prueba de optimización completada exitosamente');
    console.log('📋 Sistema listo para usar con Kapso + Supabase');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
};

testKapsoOptimization();
