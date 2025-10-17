/**
 * Script para verificar mensajes en la base de datos
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

const checkMessagesInDB = async () => {
  console.log('🔍 Verificando mensajes en la base de datos...');
  
  try {
    // 1. Verificar mensajes en kapso_messages
    console.log('📨 Verificando mensajes en kapso_messages...');
    const { data: messages, error: msgError } = await supabase
      .from('kapso_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (msgError) {
      console.error('❌ Error obteniendo mensajes:', msgError);
      return;
    }

    console.log(`📨 Mensajes encontrados: ${messages.length}`);
    messages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`);
      console.log(`      ID: ${msg.id}, Conversation: ${msg.conversation_id}`);
    });

    // 2. Verificar conversaciones en kapso_conversations
    console.log('\n💬 Verificando conversaciones en kapso_conversations...');
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(10);

    if (convError) {
      console.error('❌ Error obteniendo conversaciones:', convError);
      return;
    }

    console.log(`💬 Conversaciones encontradas: ${conversations.length}`);
    conversations.forEach((conv, i) => {
      console.log(`   ${i + 1}. ${conv.contact_name || conv.phone_number} (${conv.status})`);
      console.log(`      ID: ${conv.id}, Conversation: ${conv.conversation_id}`);
      console.log(`      Último mensaje: ${new Date(conv.last_message_at).toLocaleString()}`);
    });

    // 3. Verificar contactos en kapso_contacts
    console.log('\n👤 Verificando contactos en kapso_contacts...');
    const { data: contacts, error: contError } = await supabase
      .from('kapso_contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (contError) {
      console.error('❌ Error obteniendo contactos:', contError);
      return;
    }

    console.log(`👤 Contactos encontrados: ${contacts.length}`);
    contacts.forEach((contact, i) => {
      console.log(`   ${i + 1}. ${contact.contact_name || contact.phone_number}`);
      console.log(`      ID: ${contact.id}, Teléfono: ${contact.phone_number}`);
    });

    // 4. Verificar si hay mensajes recientes (últimos 5 minutos)
    console.log('\n⏰ Verificando mensajes recientes (últimos 5 minutos)...');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentMessages, error: recentError } = await supabase
      .from('kapso_messages')
      .select('*')
      .gte('timestamp', fiveMinutesAgo)
      .order('timestamp', { ascending: false });

    if (recentError) {
      console.error('❌ Error obteniendo mensajes recientes:', recentError);
      return;
    }

    console.log(`⏰ Mensajes recientes: ${recentMessages.length}`);
    recentMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`);
    });

    if (recentMessages.length > 0) {
      console.log('\n✅ Los mensajes están llegando a la base de datos correctamente');
      console.log('🔍 El problema está en el frontend - los mensajes no se están mostrando');
      console.log('\n📋 Posibles causas:');
      console.log('   1. El componente KapsoChatPanel no está conectado a Supabase Realtime');
      console.log('   2. El hook useKapsoRealtime no está funcionando correctamente');
      console.log('   3. La página /kapso-chat no está cargando el componente correctamente');
      console.log('\n🔗 URLs para verificar:');
      console.log('   - Página de chat: http://localhost:3001/kapso-chat');
      console.log('   - Verificar que el componente esté cargando');
    } else {
      console.log('\n⚠️ No hay mensajes recientes en la base de datos');
      console.log('🔍 Verificar que los webhooks estén llegando correctamente');
    }

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  }
};

checkMessagesInDB();
