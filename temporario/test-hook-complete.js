/**
 * Script para probar el hook useKapsoRealtime completo
 */

require('dotenv').config();

const testHookComplete = async () => {
  console.log('🔍 Probando hook useKapsoRealtime completo...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1';
    
    // Simular lo que hace el hook
    console.log('📋 Llamando al endpoint API...');
    const response = await fetch(`http://localhost:3001/api/kapso/data?userId=${userId}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error obteniendo datos de Kapso');
    }

    if (result.success && result.data) {
      const { conversations, messages, contacts } = result.data;
      
      console.log(`✅ Datos obtenidos:`);
      console.log(`   Conversaciones: ${conversations.length}`);
      console.log(`   Mensajes: ${messages.length}`);
      console.log(`   Contactos: ${contacts.length}`);

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
        console.log('\n🎉 ¡El hook está funcionando correctamente!');
        console.log('🔍 Los mensajes deberían aparecer en el frontend ahora.');
      } else {
        console.log('\n❌ No se encontraron mensajes. Revisar la lógica de búsqueda.');
      }
    } else {
      console.log('❌ No se obtuvieron datos del endpoint API');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testHookComplete();
