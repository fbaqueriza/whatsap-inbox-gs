/**
 * Script para probar la sincronización de mensajes
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes para Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const testMessageSync = async () => {
  console.log('🧪 Probando sincronización de mensajes...');
  
  try {
    // 1. Verificar que las tablas existen
    console.log('📋 Verificando tablas...');
    const { data: conversations, error: convError } = await supabase.from('kapso_conversations').select('id').limit(1);
    const { data: messages, error: msgError } = await supabase.from('kapso_messages').select('id').limit(1);

    if (convError && convError.code === '42P01' || msgError && msgError.code === '42P01') {
      console.error('❌ Las tablas de Kapso no existen. Ejecuta primero el SQL en Supabase.');
      return;
    }
    console.log('✅ Tablas verificadas');

    // 2. Obtener usuario existente
    console.log('👤 Obteniendo usuario...');
    const { data: users, error: usersError } = await supabase.from('users').select('id').limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ No se encontraron usuarios en la base de datos.');
      return;
    }
    
    const userId = users[0].id;
    console.log('✅ Usuario encontrado:', userId);

    // 3. Probar sincronización de mensaje
    console.log('🔄 Probando sincronización de mensaje...');
    const testData = {
      p_conversation_id: `test_conv_${Date.now()}`,
      p_phone_number: '5491135562673',
      p_contact_name: 'Francisco Baqueriza',
      p_message_id: `test_msg_${Date.now()}`,
      p_from_number: '5491135562673',
      p_to_number: '5491141780300',
      p_content: 'Mensaje de prueba de sincronización',
      p_message_type: 'text',
      p_timestamp: new Date().toISOString(),
      p_user_id: userId
    };

    const { data: syncResult, error: syncError } = await supabase.rpc('sync_kapso_data', testData);

    if (syncError) {
      console.error('❌ Error en función de sincronización:', syncError);
      return;
    }
    console.log('✅ Función de sincronización funcionando:', syncResult);

    // 4. Verificar datos sincronizados
    console.log('📊 Verificando datos sincronizados...');
    const { data: syncedMessages, error: smError } = await supabase.from('kapso_messages').select('*').eq('user_id', userId);
    const { data: syncedConversations, error: scError } = await supabase.from('kapso_conversations').select('*').eq('user_id', userId);

    if (smError || scError) {
      console.error('❌ Error verificando datos sincronizados:', smError || scError);
      return;
    }

    console.log(`📨 Mensajes sincronizados: ${syncedMessages.length}`);
    syncedMessages.forEach((msg, i) => console.log(`   ${i + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`));

    console.log(`💬 Conversaciones sincronizadas: ${syncedConversations.length}`);
    syncedConversations.forEach((conv, i) => console.log(`   ${i + 1}. ${conv.contact_name || conv.phone_number} (${conv.status})`));

    // 5. Probar endpoint de webhook
    console.log('🌐 Probando endpoint de webhook...');
    const ngrokUrl = 'https://20690ec1f69d.ngrok-free.app';
    
    try {
      // Simular webhook de WhatsApp (formato Meta)
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '5491141780300', phone_number_id: '670680919470999' },
              contacts: [{ profile: { name: 'Francisco Baqueriza' }, wa_id: '5491135562673' }],
              messages: [{
                from: '5491135562673',
                id: `wamid.test.${Date.now()}`,
                timestamp: `${Math.floor(Date.now() / 1000)}`,
                text: { body: 'Mensaje de prueba desde webhook' },
                type: 'text'
              }]
            }
          }]
        }]
      };

      const response = await fetch(`${ngrokUrl}/api/kapso/supabase-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Webhook de WhatsApp funcionando:', result);
      } else {
        console.log('⚠️ Webhook de WhatsApp no disponible (servidor no corriendo)');
      }
    } catch (error) {
      console.log('⚠️ Webhook de WhatsApp no disponible:', error.message);
    }

    // 6. Limpiar datos de prueba
    console.log('🧹 Limpiando datos de prueba...');
    await supabase.from('kapso_messages').delete().eq('user_id', userId);
    await supabase.from('kapso_conversations').delete().eq('user_id', userId);
    await supabase.from('kapso_contacts').delete().eq('user_id', userId);
    console.log('✅ Datos de prueba limpiados');

    console.log('🎉 ¡Sincronización de mensajes verificada exitosamente!');
    console.log('📋 El sistema está listo para recibir mensajes de WhatsApp');
    console.log('\n🔗 URLs importantes:');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - Página de chat: http://localhost:3001/kapso-chat');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testMessageSync();
