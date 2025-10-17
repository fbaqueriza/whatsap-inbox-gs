/**
 * Script para debuggear el frontend y ver por qué no aparecen los mensajes
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

const testFrontendDebug = async () => {
  console.log('🔍 Debuggeando frontend - verificando datos para el hook useKapsoRealtime...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1'; // Usuario fijo del hook
    
    // 1. Verificar conversaciones
    console.log('📋 Verificando conversaciones para el usuario:', userId);
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (convError) {
      console.error('❌ Error obteniendo conversaciones:', convError);
      return;
    }

    console.log(`✅ Conversaciones encontradas: ${conversations.length}`);
    conversations.forEach((conv, i) => {
      console.log(`   ${i + 1}. ${conv.contact_name} (${conv.phone_number}) - ${conv.status}`);
      console.log(`      ID: ${conv.id}, Conversation ID: ${conv.conversation_id}`);
    });

    // 2. Verificar mensajes
    console.log('\n📨 Verificando mensajes para el usuario:', userId);
    const { data: messages, error: msgError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    if (msgError) {
      console.error('❌ Error obteniendo mensajes:', msgError);
      return;
    }

    console.log(`✅ Mensajes encontrados: ${messages.length}`);
    messages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.content} (${msg.from_number}) - ${new Date(msg.timestamp).toLocaleString()}`);
      console.log(`      ID: ${msg.id}, Conversation ID: ${msg.conversation_id}`);
    });

    // 3. Verificar contactos
    console.log('\n👤 Verificando contactos para el usuario:', userId);
    const { data: contacts, error: contError } = await supabase
      .from('kapso_contacts')
      .select('*')
      .eq('user_id', userId);

    if (contError) {
      console.error('❌ Error obteniendo contactos:', contError);
      return;
    }

    console.log(`✅ Contactos encontrados: ${contacts.length}`);
    contacts.forEach((contact, i) => {
      console.log(`   ${i + 1}. ${contact.contact_name} (${contact.phone_number})`);
      console.log(`      ID: ${contact.id}`);
    });

    // 4. Verificar si hay datos para el contacto específico
    const testPhone = '5491135562673';
    console.log(`\n🔍 Verificando datos para el teléfono: ${testPhone}`);
    
    const conversationForPhone = conversations.find(conv => 
      conv.phone_number === testPhone || conv.phone_number === '541135562673'
    );
    
    if (conversationForPhone) {
      console.log('✅ Conversación encontrada:', conversationForPhone);
      
      const messagesForPhone = messages.filter(msg => 
        msg.conversation_id === conversationForPhone.conversation_id
      );
      
      console.log(`✅ Mensajes para este teléfono: ${messagesForPhone.length}`);
      messagesForPhone.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.content} - ${new Date(msg.timestamp).toLocaleString()}`);
      });
    } else {
      console.log('❌ No se encontró conversación para este teléfono');
    }

    // 5. Verificar normalización de números
    console.log('\n🔢 Verificando normalización de números...');
    const normalizePhone = (phone) => {
      if (!phone) return '';
      let normalized = phone.replace(/[^\d+]/g, '');
      if (!normalized.startsWith('+')) {
        normalized = '+' + normalized;
      }
      if (normalized.startsWith('+54') || normalized.startsWith('+67')) {
        return normalized;
      }
      if (normalized.startsWith('+') && normalized.length === 11) {
        return '+54' + normalized.substring(1);
      }
      return normalized;
    };

    const testNumbers = ['5491135562673', '541135562673', '+5491135562673', '+541135562673'];
    testNumbers.forEach(num => {
      const normalized = normalizePhone(num);
      console.log(`   ${num} -> ${normalized}`);
    });

    console.log('\n🎯 Diagnóstico:');
    console.log('1. Verifica que el hook useKapsoRealtime esté cargando estos datos');
    console.log('2. Verifica que el IntegratedChatPanel esté recibiendo los datos');
    console.log('3. Verifica que la normalización de números funcione correctamente');
    console.log('4. Verifica que el frontend esté conectado a Supabase Realtime');

  } catch (error) {
    console.error('❌ Error durante el debug:', error);
  }
};

testFrontendDebug();
