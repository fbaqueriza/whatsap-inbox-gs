/**
 * Script para probar el frontend en vivo
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

const testFrontendLive = async () => {
  console.log('🔍 Probando frontend en vivo...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1';
    
    // Simular exactamente lo que hace el hook useKapsoRealtime
    console.log('📋 Cargando conversaciones...');
    const { data: conversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (convError) {
      console.error('❌ Error cargando conversaciones:', convError);
      return;
    }

    console.log(`✅ Conversaciones cargadas: ${conversations.length}`);

    console.log('📨 Cargando mensajes...');
    const { data: messages, error: msgError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true });

    if (msgError) {
      console.error('❌ Error cargando mensajes:', msgError);
      return;
    }

    console.log(`✅ Mensajes cargados: ${messages.length}`);

    // Simular la lógica del IntegratedChatPanel
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

    // Simular selección de contacto
    const testPhone = '5491135562673';
    const normalizedPhone = normalizeContactIdentifier(testPhone);
    
    console.log(`\n🔍 Simulando selección de contacto: ${testPhone} -> ${normalizedPhone}`);

    // Simular la lógica del IntegratedChatPanel
    const allMessages = [];

    if (messages && messages.length > 0) {
      // Buscar conversaciones con diferentes formatos de teléfono
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
      
      if (kapsoConversation) {
        const kapsoMessagesForContact = messages.filter(msg => 
          msg.conversation_id === kapsoConversation.conversation_id
        );
        
        console.log(`📨 Mensajes en conversación: ${kapsoMessagesForContact.length}`);
        
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
        
        allMessages.push(...convertedKapsoMessages);
      } else {
        // Fallback: buscar por teléfono directo
        const kapsoMessagesForPhone = messages.filter(msg => {
          const msgPhone = normalizeContactIdentifier(msg.from_number);
          const currentPhone = normalizeContactIdentifier(testPhone);
          return msgPhone === currentPhone;
        });
        
        console.log(`📨 Mensajes por teléfono directo: ${kapsoMessagesForPhone.length}`);
        
        if (kapsoMessagesForPhone.length > 0) {
          const convertedKapsoMessages = kapsoMessagesForPhone.map(kapsoMsg => ({
            id: kapsoMsg.id,
            content: kapsoMsg.content,
            type: (kapsoMsg.from_number === normalizedPhone ? 'received' : 'sent'),
            timestamp: new Date(kapsoMsg.timestamp),
            status: (kapsoMsg.status === 'delivered' ? 'delivered' : 'sent'),
            contact_id: normalizedPhone,
            isKapsoMessage: true
          }));
          
          allMessages.push(...convertedKapsoMessages);
        }
      }
      
      // ADICIONAL: Buscar TODOS los mensajes del mismo teléfono
      const allKapsoMessagesForPhone = messages.filter(msg => {
        const msgPhone = normalizeContactIdentifier(msg.from_number);
        const currentPhone = normalizeContactIdentifier(testPhone);
        return msgPhone === currentPhone;
      });
      
      console.log(`📨 TODOS los mensajes del teléfono: ${allKapsoMessagesForPhone.length}`);
      
      if (allKapsoMessagesForPhone.length > 0) {
        // Filtrar mensajes que ya están en allMessages
        const existingIds = allMessages.map(m => m.id);
        const newMessages = allKapsoMessagesForPhone.filter(msg => !existingIds.includes(msg.id));
        
        if (newMessages.length > 0) {
          const convertedNewMessages = newMessages.map(kapsoMsg => ({
            id: kapsoMsg.id,
            content: kapsoMsg.content,
            type: (kapsoMsg.from_number === normalizedPhone ? 'received' : 'sent'),
            timestamp: new Date(kapsoMsg.timestamp),
            status: (kapsoMsg.status === 'delivered' ? 'delivered' : 'sent'),
            contact_id: normalizedPhone,
            isKapsoMessage: true
          }));
          
          allMessages.push(...convertedNewMessages);
        }
      }
    }

    // Ordenar mensajes
    allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`\n✅ Mensajes finales para mostrar: ${allMessages.length}`);
    allMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. [${msg.type}] ${msg.content} - ${msg.timestamp.toLocaleString()}`);
    });

    if (allMessages.length > 0) {
      console.log('\n🎉 ¡Los mensajes deberían aparecer en el frontend!');
      console.log('🔍 Si no aparecen, el problema está en:');
      console.log('   1. El hook useKapsoRealtime no está cargando los datos');
      console.log('   2. El IntegratedChatPanel no está recibiendo los datos');
      console.log('   3. El frontend no está conectado a Supabase Realtime');
    } else {
      console.log('\n❌ No se encontraron mensajes. Revisar la lógica de búsqueda.');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testFrontendLive();
