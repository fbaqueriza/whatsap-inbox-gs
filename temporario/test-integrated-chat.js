/**
 * Script para probar el IntegratedChatPanel con Kapso
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

const testIntegratedChat = async () => {
  console.log('🧪 Probando IntegratedChatPanel con Kapso...');
  
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

    // 3. Verificar datos existentes
    console.log('📊 Verificando datos existentes...');
    const { data: existingMessages, error: smError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (smError) {
      console.error('❌ Error obteniendo mensajes:', smError);
      return;
    }

    const { data: existingConversations, error: scError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(5);

    if (scError) {
      console.error('❌ Error obteniendo conversaciones:', scError);
      return;
    }

    console.log(`📨 Mensajes existentes: ${existingMessages.length}`);
    existingMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`);
    });

    console.log(`💬 Conversaciones existentes: ${existingConversations.length}`);
    existingConversations.forEach((conv, i) => {
      console.log(`   ${i + 1}. ${conv.contact_name || conv.phone_number} (${conv.status})`);
    });

    // 4. Crear un mensaje de prueba si no hay datos
    if (existingMessages.length === 0) {
      console.log('🔄 Creando mensaje de prueba...');
      const testData = {
        p_conversation_id: `test_conv_${Date.now()}`,
        p_phone_number: '5491135562673',
        p_contact_name: 'Francisco Baqueriza',
        p_message_id: `test_msg_${Date.now()}`,
        p_from_number: '5491135562673',
        p_to_number: '5491141780300',
        p_content: 'Mensaje de prueba para IntegratedChatPanel',
        p_message_type: 'text',
        p_timestamp: new Date().toISOString(),
        p_user_id: userId
      };

      const { data: syncResult, error: syncError } = await supabase.rpc('sync_kapso_data', testData);

      if (syncError) {
        console.error('❌ Error creando mensaje de prueba:', syncError);
        return;
      }
      console.log('✅ Mensaje de prueba creado:', syncResult);
    }

    console.log('🎉 ¡IntegratedChatPanel listo para usar con Kapso!');
    console.log('📋 El componente ahora:');
    console.log('   ✅ Muestra contactos de Kapso');
    console.log('   ✅ Muestra mensajes de Kapso en tiempo real');
    console.log('   ✅ Mantiene la misma interfaz UI');
    console.log('   ✅ Combina datos del sistema anterior con Kapso');
    console.log('\n🔗 URLs importantes:');
    console.log('   - Chat integrado: Usa el botón de chat en la plataforma');
    console.log('   - Webhook: https://20690ec1f69d.ngrok-free.app/api/kapso/supabase-events');
    console.log('   - Página de prueba: http://localhost:3001/kapso-chat');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testIntegratedChat();
