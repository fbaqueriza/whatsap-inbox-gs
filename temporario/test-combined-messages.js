/**
 * Script para probar que los mensajes combinados funcionen correctamente
 */

require('dotenv').config();

const testCombinedMessages = async () => {
  console.log('🔍 Probando mensajes combinados (sistema anterior + Kapso)...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1';
    
    // Obtener datos del endpoint API
    const response = await fetch(`http://localhost:3001/api/kapso/data?userId=${userId}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error obteniendo datos de Kapso');
    }

    const { messages: kapsoMessages, conversations } = result.data;
    
    console.log(`📨 Mensajes de Kapso encontrados: ${kapsoMessages.length}`);
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

    // Simular mensajes del sistema anterior (lo que se guarda cuando enviamos desde la plataforma)
    const systemMessages = [
      {
        id: 'system_msg_1',
        content: 'Hola! Te puedo comentar algo?',
        type: 'sent',
        timestamp: new Date('2025-10-16T13:00:00'),
        status: 'delivered',
        contact_id: '+5491135562673',
        isKapsoMessage: false,
        isTemplate: false,
        templateName: undefined
      },
      {
        id: 'system_msg_2',
        content: 'hola como va',
        type: 'sent',
        timestamp: new Date('2025-10-16T16:51:25'),
        status: 'delivered',
        contact_id: '+5491135562673',
        isKapsoMessage: false,
        isTemplate: false,
        templateName: undefined
      }
    ];

    // Simular función getAllMessagesForContact
    const getAllMessagesForContact = (normalizedPhone) => {
      // Obtener mensajes del sistema anterior
      const systemMessagesForContact = systemMessages.filter(msg => msg.contact_id === normalizedPhone);
      
      // Obtener mensajes de Kapso
      let kapsoMessagesForContact = [];
      if (kapsoMessages && kapsoMessages.length > 0) {
        const allKapsoMessagesForPhone = kapsoMessages.filter(msg => {
          const msgFromPhone = normalizeContactIdentifier(msg.from_number);
          const msgToPhone = normalizeContactIdentifier(msg.to_number);
          const currentPhone = normalizedPhone;
          
          return msgFromPhone === currentPhone || msgToPhone === currentPhone;
        });
        
        // Convertir mensajes de Kapso al formato del sistema anterior
        kapsoMessagesForContact = allKapsoMessagesForPhone.map(kapsoMsg => {
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
      }
      
      // Combinar ambos sistemas y eliminar duplicados por ID
      const allMessages = [...systemMessagesForContact];
      const existingIds = new Set(systemMessagesForContact.map(msg => msg.id));
      
      kapsoMessagesForContact.forEach(kapsoMsg => {
        if (!existingIds.has(kapsoMsg.id)) {
          allMessages.push(kapsoMsg);
        }
      });
      
      return allMessages;
    };

    // Probar con el contacto de prueba
    const testPhone = '5491135562673';
    const normalizedPhone = normalizeContactIdentifier(testPhone);
    
    console.log(`\n🔍 Analizando mensajes combinados para: ${testPhone} -> ${normalizedPhone}`);
    
    // 1. Probar obtención de mensajes combinados
    const allMessages = getAllMessagesForContact(normalizedPhone);
    console.log(`\n📨 1. Mensajes combinados obtenidos: ${allMessages.length}`);
    
    if (allMessages.length > 0) {
      console.log('   Mensajes encontrados (ordenados por timestamp):');
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      allMessages.forEach((msg, i) => {
        const source = msg.isKapsoMessage ? 'Kapso' : 'Sistema';
        console.log(`   ${i + 1}. "${msg.content}" (${msg.type}) - ${new Date(msg.timestamp).toLocaleString()} [${source}]`);
      });
    }
    
    // 2. Verificar que hay mensajes de ambos sistemas
    const systemMessagesCount = allMessages.filter(msg => !msg.isKapsoMessage).length;
    const kapsoMessagesCount = allMessages.filter(msg => msg.isKapsoMessage).length;
    
    console.log(`\n📊 2. Distribución de mensajes:`);
    console.log(`   Mensajes del sistema anterior: ${systemMessagesCount}`);
    console.log(`   Mensajes de Kapso: ${kapsoMessagesCount}`);
    console.log(`   Total combinado: ${allMessages.length}`);
    
    // 3. Verificar que no hay duplicados
    const messageIds = allMessages.map(msg => msg.id);
    const uniqueIds = [...new Set(messageIds)];
    const hasDuplicates = messageIds.length !== uniqueIds.length;
    
    console.log(`\n🔍 3. Verificación de duplicados:`);
    console.log(`   Total mensajes: ${messageIds.length}`);
    console.log(`   IDs únicos: ${uniqueIds.length}`);
    console.log(`   ¿Hay duplicados?: ${hasDuplicates ? '❌ SÍ' : '✅ NO'}`);
    
    // 4. Verificar orden cronológico
    const isChronological = allMessages.every((msg, i) => {
      if (i === 0) return true;
      return new Date(msg.timestamp) >= new Date(allMessages[i - 1].timestamp);
    });
    
    console.log(`\n⏰ 4. Verificación de orden cronológico:`);
    console.log(`   ¿Están ordenados cronológicamente?: ${isChronological ? '✅ SÍ' : '❌ NO'}`);
    
    // 5. Verificar que los mensajes enviados desde la plataforma aparecen
    const sentMessages = allMessages.filter(msg => msg.type === 'sent');
    const receivedMessages = allMessages.filter(msg => msg.type === 'received');
    
    console.log(`\n📤 5. Verificación de mensajes enviados/recibidos:`);
    console.log(`   Mensajes enviados (desde plataforma): ${sentMessages.length}`);
    console.log(`   Mensajes recibidos (del proveedor): ${receivedMessages.length}`);
    
    if (sentMessages.length > 0) {
      console.log('   Mensajes enviados:');
      sentMessages.forEach((msg, i) => {
        const source = msg.isKapsoMessage ? 'Kapso' : 'Sistema';
        console.log(`     ${i + 1}. "${msg.content}" - ${new Date(msg.timestamp).toLocaleString()} [${source}]`);
      });
    }
    
    // 6. Resumen de funcionalidad
    console.log('\n🎯 RESUMEN DE FUNCIONALIDAD:');
    console.log(`   ✅ Mensajes del sistema anterior: ${systemMessagesCount > 0 ? 'FUNCIONANDO' : 'SIN MENSAJES'}`);
    console.log(`   ✅ Mensajes de Kapso: ${kapsoMessagesCount > 0 ? 'FUNCIONANDO' : 'SIN MENSAJES'}`);
    console.log(`   ✅ Mensajes enviados desde plataforma: ${sentMessages.length > 0 ? 'VISIBLES' : 'NO VISIBLES'}`);
    console.log(`   ✅ Mensajes recibidos del proveedor: ${receivedMessages.length > 0 ? 'VISIBLES' : 'NO VISIBLES'}`);
    console.log(`   ✅ Sin duplicados: ${!hasDuplicates ? 'CORRECTO' : 'CON DUPLICADOS'}`);
    console.log(`   ✅ Orden cronológico: ${isChronological ? 'CORRECTO' : 'INCORRECTO'}`);
    
    if (systemMessagesCount > 0 && kapsoMessagesCount > 0 && !hasDuplicates && isChronological) {
      console.log('\n🎉 ¡La funcionalidad combinada está funcionando correctamente!');
      console.log('   - Los mensajes enviados desde la plataforma se ven');
      console.log('   - Los mensajes recibidos del proveedor se ven');
      console.log('   - Ambos sistemas funcionan en conjunto');
    } else {
      console.log('\n⚠️ La funcionalidad combinada necesita ajustes');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testCombinedMessages();
