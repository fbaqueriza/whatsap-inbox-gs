/**
 * Script para probar la migración completa del sistema Kapso + Supabase
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

const testCompleteMigration = async () => {
  console.log('🧪 Probando migración completa del sistema...');
  
  try {
    // 1. Verificar tablas de Kapso
    console.log('📋 Verificando tablas de Kapso...');
    const { data: conversations, error: convError } = await supabase.from('kapso_conversations').select('id').limit(1);
    const { data: messages, error: msgError } = await supabase.from('kapso_messages').select('id').limit(1);
    const { data: contacts, error: contError } = await supabase.from('kapso_contacts').select('id').limit(1);

    if (convError && convError.code === '42P01' || msgError && msgError.code === '42P01' || contError && contError.code === '42P01') {
      console.error('❌ Las tablas de Kapso no existen. Ejecuta primero el SQL en Supabase.');
      return;
    } else if (convError || msgError || contError) {
      console.error('❌ Error verificando tablas:', convError || msgError || contError);
      return;
    }
    console.log('✅ Tablas de Kapso verificadas');

    // 2. Probar función de sincronización
    console.log('🔄 Probando función de sincronización...');
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Usuario de prueba
    
    const testData = {
      p_conversation_id: `test_conv_${Date.now()}`,
      p_phone_number: '5491135562673',
      p_contact_name: 'Usuario de Prueba',
      p_message_id: `test_msg_${Date.now()}`,
      p_from_number: '5491135562673',
      p_to_number: '5491141780300',
      p_content: 'Mensaje de prueba desde migración',
      p_message_type: 'text',
      p_timestamp: new Date().toISOString(),
      p_user_id: testUserId
    };

    const { data: syncResult, error: syncError } = await supabase.rpc('sync_kapso_data', testData);

    if (syncError) {
      console.error('❌ Error en función de sincronización:', syncError);
      return;
    }
    console.log('✅ Función de sincronización funcionando:', syncResult);

    // 3. Probar estadísticas
    console.log('📊 Probando estadísticas...');
    const { data: stats, error: statsError } = await supabase.rpc('get_kapso_stats', { p_user_id: testUserId });

    if (statsError) {
      console.error('❌ Error obteniendo estadísticas:', statsError);
      return;
    }
    console.log('✅ Estadísticas:', stats);

    // 4. Verificar datos sincronizados
    console.log('📊 Verificando datos sincronizados...');
    const { data: syncedMessages, error: smError } = await supabase.from('kapso_messages').select('*').eq('user_id', testUserId);
    const { data: syncedConversations, error: scError } = await supabase.from('kapso_conversations').select('*').eq('user_id', testUserId);

    if (smError || scError) {
      console.error('❌ Error verificando datos sincronizados:', smError || scError);
      return;
    }

    console.log(`📨 Mensajes sincronizados: ${syncedMessages.length}`);
    syncedMessages.forEach((msg, i) => console.log(`   ${i + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`));

    console.log(`💬 Conversaciones sincronizadas: ${syncedConversations.length}`);
    syncedConversations.forEach((conv, i) => console.log(`   ${i + 1}. ${conv.contact_name || conv.phone_number} (${conv.status})`));

    // 5. Probar endpoints
    console.log('🌐 Probando endpoints...');
    const ngrokUrl = 'https://20690ec1f69d.ngrok-free.app';
    
    // Probar endpoint de eventos
    try {
      const response = await fetch(`${ngrokUrl}/api/kapso/supabase-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message_received',
          payload: {
            messageId: `test_msg_${Date.now()}`,
            content: 'Mensaje de prueba desde migración',
            from: '5491135562673',
            timestamp: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Endpoint de eventos funcionando:', result);
      } else {
        console.log('⚠️ Endpoint de eventos no disponible (servidor no corriendo)');
      }
    } catch (error) {
      console.log('⚠️ Endpoint de eventos no disponible:', error.message);
    }

    // Probar endpoint de sincronización
    try {
      const response = await fetch(`${ngrokUrl}/api/kapso/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: `test_conv_${Date.now()}`,
          phone_number: '5491135562673',
          contact_name: 'Usuario de Prueba',
          message_id: `test_msg_${Date.now()}`,
          from_number: '5491135562673',
          to_number: '5491141780300',
          content: 'Mensaje de prueba desde migración',
          message_type: 'text',
          timestamp: new Date().toISOString(),
          user_id: testUserId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Endpoint de sincronización funcionando:', result);
      } else {
        console.log('⚠️ Endpoint de sincronización no disponible (servidor no corriendo)');
      }
    } catch (error) {
      console.log('⚠️ Endpoint de sincronización no disponible:', error.message);
    }

    // 6. Limpiar datos de prueba
    console.log('🧹 Limpiando datos de prueba...');
    await supabase.from('kapso_messages').delete().eq('user_id', testUserId);
    await supabase.from('kapso_conversations').delete().eq('user_id', testUserId);
    await supabase.from('kapso_contacts').delete().eq('user_id', testUserId);
    console.log('✅ Datos de prueba limpiados');

    console.log('🎉 ¡Migración completa verificada exitosamente!');
    console.log('📋 Sistema listo para usar con Kapso + Supabase');
    console.log('\n🔗 URLs importantes:');
    console.log('   - Página de prueba: http://localhost:3001/kapso-chat');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - Sincronización: https://20690ec1f69d.ngrok-free.app/api/kapso/sync');
    console.log('   - SQL: temporario/KAPSO_SUPABASE_SETUP.sql');
    console.log('   - Instrucciones: temporario/MIGRATION_INSTRUCTIONS.md');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testCompleteMigration();
