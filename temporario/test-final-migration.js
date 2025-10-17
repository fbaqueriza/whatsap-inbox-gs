/**
 * Script final para probar la migración completa
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

const testFinalMigration = async () => {
  console.log('🧪 Probando migración final del sistema...');
  
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

    // 2. Obtener o crear usuario
    console.log('👤 Obteniendo usuario...');
    let testUserId = null;

    // Intentar obtener usuario existente
    const { data: users, error: usersError } = await supabase.from('users').select('id').limit(1);
    
    if (users && users.length > 0) {
      testUserId = users[0].id;
      console.log('✅ Usando usuario existente:', testUserId);
    } else {
      // Crear usuario de prueba con email único
      const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
      console.log('👤 Creando usuario de prueba:', uniqueEmail);
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: uniqueEmail,
        password: 'password123',
        email_confirm: true,
      });

      if (createError) {
        console.error('❌ Error creando usuario de prueba:', createError);
        return;
      }
      
      testUserId = newUser.user.id;
      console.log('✅ Usuario de prueba creado:', testUserId);
    }

    // 3. Probar función de sincronización
    console.log('🔄 Probando función de sincronización...');
    const testData = {
      p_conversation_id: `test_conv_${Date.now()}`,
      p_phone_number: '5491135562673',
      p_contact_name: 'Usuario de Prueba',
      p_message_id: `test_msg_${Date.now()}`,
      p_from_number: '5491135562673',
      p_to_number: '5491141780300',
      p_content: 'Mensaje de prueba desde migración final',
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

    // 4. Probar estadísticas
    console.log('📊 Probando estadísticas...');
    const { data: stats, error: statsError } = await supabase.rpc('get_kapso_stats', { p_user_id: testUserId });

    if (statsError) {
      console.error('❌ Error obteniendo estadísticas:', statsError);
      return;
    }
    console.log('✅ Estadísticas:', stats);

    // 5. Verificar datos sincronizados
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

    // 6. Limpiar datos de prueba
    console.log('🧹 Limpiando datos de prueba...');
    await supabase.from('kapso_messages').delete().eq('user_id', testUserId);
    await supabase.from('kapso_conversations').delete().eq('user_id', testUserId);
    await supabase.from('kapso_contacts').delete().eq('user_id', testUserId);
    console.log('✅ Datos de prueba limpiados');

    console.log('🎉 ¡MIGRACIÓN COMPLETA VERIFICADA EXITOSAMENTE!');
    console.log('📋 Sistema listo para usar con Kapso + Supabase');
    console.log('\n🔗 URLs importantes:');
    console.log('   - Página de prueba: http://localhost:3001/kapso-chat');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - Sincronización: https://20690ec1f69d.ngrok-free.app/api/kapso/sync');
    console.log('   - SQL: temporario/KAPSO_SUPABASE_SETUP.sql');
    console.log('   - Instrucciones: temporario/MIGRATION_INSTRUCTIONS.md');
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('   1. Configura el webhook en Kapso');
    console.log('   2. Prueba la página: http://localhost:3001/kapso-chat');
    console.log('   3. Envía un mensaje de WhatsApp');
    console.log('   4. Verifica que aparezca en tiempo real');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testFinalMigration();
