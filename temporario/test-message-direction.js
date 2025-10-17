/**
 * Script para probar la dirección correcta de los mensajes
 */

require('dotenv').config();

const testMessageDirection = async () => {
  console.log('🔍 Probando dirección correcta de mensajes...');
  
  try {
    const userId = '39a01409-56ed-4ae6-884a-148ad5edb1e1';
    
    // Obtener datos del endpoint API
    const response = await fetch(`http://localhost:3001/api/kapso/data?userId=${userId}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error obteniendo datos de Kapso');
    }

    const { messages } = result.data;
    
    console.log(`📨 Mensajes encontrados: ${messages.length}`);
    
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

    // Simular contacto seleccionado
    const testPhone = '5491135562673';
    const normalizedPhone = normalizeContactIdentifier(testPhone);
    
    console.log(`\n🔍 Analizando mensajes para: ${testPhone} -> ${normalizedPhone}`);
    
    // Filtrar mensajes del contacto
    const contactMessages = messages.filter(msg => {
      const msgFromPhone = normalizeContactIdentifier(msg.from_number);
      const msgToPhone = normalizeContactIdentifier(msg.to_number);
      return msgFromPhone === normalizedPhone || msgToPhone === normalizedPhone;
    });
    
    console.log(`📨 Mensajes del contacto: ${contactMessages.length}`);
    
    // Analizar cada mensaje
    contactMessages.forEach((msg, i) => {
      const isFromContact = normalizeContactIdentifier(msg.from_number) === normalizedPhone;
      const isToContact = normalizeContactIdentifier(msg.to_number) === normalizedPhone;
      
      let messageType;
      if (isFromContact) {
        messageType = 'received'; // Mensaje recibido del contacto
      } else if (isToContact) {
        messageType = 'sent'; // Mensaje enviado al contacto
      } else {
        messageType = 'unknown';
      }
      
      console.log(`\n   ${i + 1}. Mensaje: "${msg.content}"`);
      console.log(`      From: ${msg.from_number} (${isFromContact ? 'CONTACTO' : 'OTRO'})`);
      console.log(`      To: ${msg.to_number} (${isToContact ? 'CONTACTO' : 'OTRO'})`);
      console.log(`      Tipo calculado: ${messageType}`);
      console.log(`      Timestamp: ${new Date(msg.timestamp).toLocaleString()}`);
    });
    
    console.log('\n🎯 Verificación:');
    console.log('   - Los mensajes FROM el contacto deberían ser "received"');
    console.log('   - Los mensajes TO el contacto deberían ser "sent"');
    
    // Verificar si hay mensajes con dirección incorrecta
    const incorrectMessages = contactMessages.filter(msg => {
      const isFromContact = normalizeContactIdentifier(msg.from_number) === normalizedPhone;
      const isToContact = normalizeContactIdentifier(msg.to_number) === normalizedPhone;
      
      // Si viene del contacto, debería ser 'received'
      if (isFromContact && !isToContact) {
        return false; // Correcto
      }
      // Si va al contacto, debería ser 'sent'
      if (isToContact && !isFromContact) {
        return false; // Correcto
      }
      // Si es ambiguo o incorrecto
      return true;
    });
    
    if (incorrectMessages.length === 0) {
      console.log('\n✅ ¡Todos los mensajes tienen dirección correcta!');
    } else {
      console.log(`\n❌ ${incorrectMessages.length} mensajes con dirección incorrecta`);
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
};

testMessageDirection();
