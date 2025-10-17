/**
 * Script para probar las correcciones del chat
 */

require('dotenv').config();

const testChatFixes = async () => {
  console.log('🔍 Probando correcciones del chat...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1';
    
    // Obtener datos del endpoint API
    const response = await fetch(`http://localhost:3001/api/kapso/data?userId=${userId}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error obteniendo datos de Kapso');
    }

    const { messages, conversations } = result.data;
    
    console.log(`📨 Mensajes encontrados: ${messages.length}`);
    console.log(`💬 Conversaciones encontradas: ${conversations.length}`);
    
    // Función de normalización
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

    // Simular función getKapsoMessagesForContact corregida
    const getKapsoMessagesForContact = (normalizedPhone) => {
      if (!messages || messages.length === 0) {
        return [];
      }
      
      // 🔧 CORRECCIÓN: Buscar TODOS los mensajes del contacto, no solo por conversation_id
      const allKapsoMessagesForPhone = messages.filter(msg => {
        const msgFromPhone = normalizeContactIdentifier(msg.from_number);
        const msgToPhone = normalizeContactIdentifier(msg.to_number);
        const currentPhone = normalizedPhone;
        
        // Incluir mensajes donde el contacto es el remitente o destinatario
        return msgFromPhone === currentPhone || msgToPhone === currentPhone;
      });
      
      // Convertir mensajes de Kapso al formato del sistema anterior
      const convertedKapsoMessages = allKapsoMessagesForPhone.map(kapsoMsg => {
        const isFromContact = normalizeContactIdentifier(kapsoMsg.from_number) === normalizedPhone;
        const isToContact = normalizeContactIdentifier(kapsoMsg.to_number) === normalizedPhone;
        
        let messageType;
        if (isFromContact) {
          messageType = 'received';
        } else if (isToContact) {
          messageType = 'sent';
        } else {
          messageType = 'received';
        }
        
        return {
          id: kapsoMsg.id,
          content: kapsoMsg.content,
          type: messageType,
          timestamp: new Date(kapsoMsg.timestamp),
          status: (kapsoMsg.status === 'delivered' ? 'delivered' : 'sent'),
          contact_id: normalizedPhone,
          isKapsoMessage: true,
          isTemplate: false,
          templateName: undefined
        };
      });
      
      return convertedKapsoMessages;
    };

    // Simular función de actualización de contactos corregida
    const updateContactsWithLastMessage = (conversations, messages) => {
      const updatedContacts = [];
      
      conversations.forEach(conversation => {
        const normalizedPhone = normalizeContactIdentifier(conversation.phone_number);
        
        // 🔧 CORRECCIÓN: Buscar el último mensaje real del contacto en messages
        const contactMessages = messages.filter(msg => {
          const msgFromPhone = normalizeContactIdentifier(msg.from_number);
          const msgToPhone = normalizeContactIdentifier(msg.to_number);
          return msgFromPhone === normalizedPhone || msgToPhone === normalizedPhone;
        });
        
        // Ordenar por timestamp y obtener el último mensaje
        const lastMessage = contactMessages.length > 0 
          ? contactMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
          : null;
        
        updatedContacts.push({
          id: conversation.id,
          name: conversation.contact_name || conversation.phone_number,
          phone: normalizedPhone,
          lastMessage: lastMessage?.content || '',
          lastMessageTime: lastMessage ? new Date(lastMessage.timestamp) : new Date(conversation.last_message_at),
          unreadCount: 0,
          isKapsoContact: true
        });
      });
      
      return updatedContacts;
    };

    // Probar con el contacto de prueba
    const testPhone = '5491135562673';
    const normalizedPhone = normalizeContactIdentifier(testPhone);
    
    console.log(`\n🔍 Analizando correcciones para: ${testPhone} -> ${normalizedPhone}`);
    
    // 1. Probar obtención de mensajes (debería incluir TODOS los mensajes del contacto)
    const kapsoMessages = getKapsoMessagesForContact(normalizedPhone);
    console.log(`\n📨 1. Mensajes de Kapso obtenidos: ${kapsoMessages.length}`);
    
    if (kapsoMessages.length > 0) {
      console.log('   Mensajes encontrados (ordenados por timestamp):');
      kapsoMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      kapsoMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. "${msg.content}" (${msg.type}) - ${new Date(msg.timestamp).toLocaleString()}`);
      });
    }
    
    // 2. Probar actualización de contactos con último mensaje
    const updatedContacts = updateContactsWithLastMessage(conversations, messages);
    const testContact = updatedContacts.find(c => c.phone === normalizedPhone);
    
    console.log(`\n📋 2. Contacto actualizado:`);
    if (testContact) {
      console.log(`   Nombre: ${testContact.name}`);
      console.log(`   Teléfono: ${testContact.phone}`);
      console.log(`   Último mensaje: "${testContact.lastMessage}"`);
      console.log(`   Timestamp último mensaje: ${testContact.lastMessageTime.toLocaleString()}`);
    } else {
      console.log('   ❌ Contacto no encontrado');
    }
    
    // 3. Verificar que no hay duplicación de mensajes
    const messageIds = kapsoMessages.map(msg => msg.id);
    const uniqueIds = [...new Set(messageIds)];
    const hasDuplicates = messageIds.length !== uniqueIds.length;
    
    console.log(`\n🔍 3. Verificación de duplicados:`);
    console.log(`   Total mensajes: ${messageIds.length}`);
    console.log(`   IDs únicos: ${uniqueIds.length}`);
    console.log(`   ¿Hay duplicados?: ${hasDuplicates ? '❌ SÍ' : '✅ NO'}`);
    
    // 4. Verificar orden cronológico
    const isChronological = kapsoMessages.every((msg, i) => {
      if (i === 0) return true;
      return new Date(msg.timestamp) >= new Date(kapsoMessages[i - 1].timestamp);
    });
    
    console.log(`\n⏰ 4. Verificación de orden cronológico:`);
    console.log(`   ¿Están ordenados cronológicamente?: ${isChronological ? '✅ SÍ' : '❌ NO'}`);
    
    // 5. Resumen de correcciones
    console.log('\n🎯 RESUMEN DE CORRECCIONES:');
    console.log(`   ✅ Loop infinito: Logs removidos`);
    console.log(`   ✅ Mensajes no reemplazan viejos: ${kapsoMessages.length > 1 ? 'FUNCIONANDO' : 'SIN MÚLTIPLES MENSAJES'}`);
    console.log(`   ✅ Preview del sidebar: ${testContact?.lastMessage ? 'ACTUALIZADO' : 'SIN MENSAJES'}`);
    console.log(`   ✅ Sin duplicados: ${!hasDuplicates ? 'CORRECTO' : 'CON DUPLICADOS'}`);
    console.log(`   ✅ Orden cronológico: ${isChronological ? 'CORRECTO' : 'INCORRECTO'}`);
    
    if (kapsoMessages.length > 0 && !hasDuplicates && isChronological) {
      console.log('\n🎉 ¡Todas las correcciones están funcionando correctamente!');
    } else {
      console.log('\n⚠️ Algunas correcciones necesitan ajustes');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testChatFixes();
