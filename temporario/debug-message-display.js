const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugMessageDisplay() {
  console.log('🔍 [DEBUG] Diagnosticando por qué los mensajes no aparecen en el frontend...\n');

  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';
  const phoneNumber = '5491135562673';

  try {
    // 1. Verificar mensajes en kapso_messages
    console.log('📱 [DEBUG] 1. Verificando mensajes en kapso_messages...');
    const { data: kapsoMessages, error: kapsoError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (kapsoError) {
      console.error('❌ Error obteniendo mensajes de Kapso:', kapsoError);
    } else {
      console.log(`✅ Mensajes de Kapso encontrados: ${kapsoMessages.length}`);
      kapsoMessages.forEach(msg => {
        console.log(`  - ID: ${msg.id}, From: ${msg.from_number}, To: ${msg.to_number}, Content: "${msg.content}", Timestamp: ${msg.timestamp}`);
      });
    }

    // 2. Verificar conversaciones en kapso_conversations
    console.log('\n📱 [DEBUG] 2. Verificando conversaciones en kapso_conversations...');
    const { data: kapsoConversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(5);

    if (convError) {
      console.error('❌ Error obteniendo conversaciones de Kapso:', convError);
    } else {
      console.log(`✅ Conversaciones de Kapso encontradas: ${kapsoConversations.length}`);
      kapsoConversations.forEach(conv => {
        console.log(`  - ID: ${conv.id}, Phone: ${conv.phone_number}, Name: ${conv.contact_name}, Last Message: ${conv.last_message_at}`);
      });
    }

    // 3. Verificar mensajes en whatsapp_messages (sistema anterior)
    console.log('\n📱 [DEBUG] 3. Verificando mensajes en whatsapp_messages (sistema anterior)...');
    const { data: oldMessages, error: oldError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5);

    if (oldError) {
      console.error('❌ Error obteniendo mensajes del sistema anterior:', oldError);
    } else {
      console.log(`✅ Mensajes del sistema anterior encontrados: ${oldMessages.length}`);
      oldMessages.forEach(msg => {
        console.log(`  - ID: ${msg.id}, From: ${msg.from_number}, To: ${msg.to_number}, Content: "${msg.content}", Timestamp: ${msg.timestamp}`);
      });
    }

    // 4. Verificar el endpoint API de Kapso
    console.log('\n📱 [DEBUG] 4. Verificando endpoint API de Kapso...');
    try {
      const response = await fetch(`http://localhost:3001/api/kapso/data?userId=${userId}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log('✅ Endpoint API de Kapso funcionando:');
        console.log(`  - Conversaciones: ${result.data.conversations?.length || 0}`);
        console.log(`  - Contactos: ${result.data.contacts?.length || 0}`);
        console.log(`  - Mensajes: ${result.data.messages?.length || 0}`);
        
        if (result.data.messages && result.data.messages.length > 0) {
          console.log('  - Últimos mensajes:');
          result.data.messages.slice(0, 3).forEach(msg => {
            console.log(`    * From: ${msg.from_number}, To: ${msg.to_number}, Content: "${msg.content}"`);
          });
        }
      } else {
        console.error('❌ Error en endpoint API de Kapso:', result.error);
      }
    } catch (apiError) {
      console.error('❌ Error llamando endpoint API de Kapso:', apiError);
    }

    // 5. Verificar normalización de números
    console.log('\n📱 [DEBUG] 5. Verificando normalización de números...');
    const normalizeContactIdentifier = (identifier) => {
      if (!identifier) return '';
      let normalized = identifier.replace(/[^\d+]/g, '');
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

    const normalizedPhone = normalizeContactIdentifier(phoneNumber);
    console.log(`  - Número original: ${phoneNumber}`);
    console.log(`  - Número normalizado: ${normalizedPhone}`);

    // 6. Buscar mensajes específicos para este número
    console.log('\n📱 [DEBUG] 6. Buscando mensajes específicos para este número...');
    const { data: specificMessages, error: specificError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .or(`from_number.eq.${phoneNumber},to_number.eq.${phoneNumber}`)
      .order('created_at', { ascending: false });

    if (specificError) {
      console.error('❌ Error obteniendo mensajes específicos:', specificError);
    } else {
      console.log(`✅ Mensajes específicos encontrados: ${specificMessages.length}`);
      specificMessages.forEach(msg => {
        console.log(`  - ID: ${msg.id}, From: ${msg.from_number}, To: ${msg.to_number}, Content: "${msg.content}", Timestamp: ${msg.timestamp}`);
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugMessageDisplay();
