/**
 * Script para probar el fix del frontend
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

const testFrontendFix = async () => {
  console.log('🔧 Probando fix del frontend...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1';
    
    // Simular la lógica del frontend
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

    // Obtener datos como lo haría el hook
    const { data: conversations } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    const { data: messages } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    console.log('📋 Datos obtenidos:');
    console.log(`   Conversaciones: ${conversations.length}`);
    console.log(`   Mensajes: ${messages.length}`);

    // Simular selección de contacto
    const testPhone = '5491135562673';
    const normalizedPhone = normalizeContactIdentifier(testPhone);
    
    console.log(`\n🔍 Probando con teléfono: ${testPhone} -> ${normalizedPhone}`);

    // Buscar conversación (lógica corregida)
    const kapsoConversation = conversations?.find(conv => {
      const convPhone = normalizeContactIdentifier(conv.phone_number);
      const currentPhone = normalizeContactIdentifier(testPhone);
      
      // Comparar números normalizados
      if (convPhone === currentPhone) return true;
      
      // También comparar con formato alternativo (con/sin 9)
      const convPhoneAlt = conv.phone_number.replace(/^\+?54/, '+549');
      const currentPhoneAlt = testPhone.replace(/^\+?54/, '+549');
      
      return normalizeContactIdentifier(convPhoneAlt) === normalizeContactIdentifier(currentPhoneAlt);
    });

    console.log('🔍 Conversación encontrada:', kapsoConversation ? 'SÍ' : 'NO');
    if (kapsoConversation) {
      console.log(`   ID: ${kapsoConversation.id}`);
      console.log(`   Conversation ID: ${kapsoConversation.conversation_id}`);
      console.log(`   Teléfono: ${kapsoConversation.phone_number}`);
    }

    // Buscar mensajes (lógica mejorada)
    let kapsoMessagesForContact = [];
    
    if (kapsoConversation) {
      kapsoMessagesForContact = messages.filter(msg => 
        msg.conversation_id === kapsoConversation.conversation_id
      );
    }
    
    // ADICIONAL: Buscar TODOS los mensajes del mismo teléfono (sin importar conversación)
    const allKapsoMessagesForPhone = messages.filter(msg => {
      const msgPhone = normalizeContactIdentifier(msg.from_number);
      const currentPhone = normalizeContactIdentifier(testPhone);
      return msgPhone === currentPhone;
    });
    
    // Combinar mensajes únicos
    const allMessages = [...kapsoMessagesForContact];
    const existingIds = allMessages.map(m => m.id);
    const newMessages = allKapsoMessagesForPhone.filter(msg => !existingIds.includes(msg.id));
    allMessages.push(...newMessages);
    
    kapsoMessagesForContact = allMessages;

    console.log(`\n📨 Mensajes encontrados: ${kapsoMessagesForContact.length}`);
    kapsoMessagesForContact.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.content} - ${new Date(msg.timestamp).toLocaleString()}`);
      console.log(`      From: ${msg.from_number}, Conversation: ${msg.conversation_id}`);
    });

    // Convertir mensajes
    const convertedKapsoMessages = kapsoMessagesForContact.map(kapsoMsg => ({
      id: kapsoMsg.id,
      content: kapsoMsg.content,
      type: (kapsoMsg.from_number === normalizedPhone ? 'received' : 'sent'),
      timestamp: new Date(kapsoMsg.timestamp),
      status: (kapsoMsg.status === 'delivered' ? 'delivered' : 'sent'),
      contact_id: normalizedPhone,
      isKapsoMessage: true
    }));

    console.log(`\n✅ Mensajes convertidos: ${convertedKapsoMessages.length}`);
    convertedKapsoMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.type}] ${msg.content} - ${msg.timestamp.toLocaleString()}`);
    });

    if (convertedKapsoMessages.length > 0) {
      console.log('\n🎉 ¡Fix funcionando! Los mensajes deberían aparecer en el frontend.');
    } else {
      console.log('\n❌ Aún no se encuentran mensajes. Revisar la lógica.');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testFrontendFix();
