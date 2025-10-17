const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Función de normalización idéntica al frontend
const normalizeContactIdentifier = (identifier) => {
  if (!identifier) return '';
  
  // Remover todos los caracteres no numéricos excepto el +
  let normalized = identifier.replace(/[^\d+]/g, '');
  
  // Si no empieza con +, agregarlo
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  
  // Para números que ya tienen el formato correcto, devolverlos tal como están
  if (normalized.startsWith('+54') || normalized.startsWith('+67')) {
    return normalized;
  }
  
  // Si es un número local sin código de país, asumir Argentina
  if (normalized.startsWith('+') && normalized.length === 11) {
    return '+54' + normalized.substring(1);
  }
  
  return normalized;
};

async function debugFrontendMatching() {
  console.log('🔍 [DEBUG] Simulando la lógica de matching del frontend...\n');

  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';
  const phoneNumber = '5491135562673';

  try {
    // 1. Obtener mensajes de Kapso
    console.log('📱 [DEBUG] 1. Obteniendo mensajes de Kapso...');
    const { data: kapsoMessages, error: kapsoError } = await supabase
      .from('kapso_messages')
      .select('*')
      .eq('user_id', userId);

    if (kapsoError) {
      console.error('❌ Error obteniendo mensajes de Kapso:', kapsoError);
      return;
    }

    console.log(`✅ Mensajes de Kapso encontrados: ${kapsoMessages.length}`);

    // 2. Simular la lógica de getAllMessagesForContact
    console.log('\n📱 [DEBUG] 2. Simulando getAllMessagesForContact...');
    const normalizedPhone = normalizeContactIdentifier(phoneNumber);
    console.log(`  - Número normalizado: ${normalizedPhone}`);

    // Simular messagesByContact (sistema anterior) - vacío por ahora
    const messagesByContact = {};

    // Obtener mensajes de Kapso para este contacto
    let kapsoMessagesForContact = [];
    if (kapsoMessages && kapsoMessages.length > 0) {
      console.log('\n📱 [DEBUG] 3. Filtrando mensajes de Kapso...');
      
      const allKapsoMessagesForPhone = kapsoMessages.filter(msg => {
        const msgFromPhone = normalizeContactIdentifier(msg.from_number);
        const msgToPhone = normalizeContactIdentifier(msg.to_number);
        const currentPhone = normalizedPhone;
        
        console.log(`  - Mensaje ID: ${msg.id}`);
        console.log(`    * From original: ${msg.from_number}`);
        console.log(`    * From normalizado: ${msgFromPhone}`);
        console.log(`    * To original: ${msg.to_number}`);
        console.log(`    * To normalizado: ${msgToPhone}`);
        console.log(`    * Current phone: ${currentPhone}`);
        console.log(`    * From match: ${msgFromPhone === currentPhone}`);
        console.log(`    * To match: ${msgToPhone === currentPhone}`);
        console.log(`    * Incluir: ${msgFromPhone === currentPhone || msgToPhone === currentPhone}`);
        console.log('');
        
        // Incluir mensajes donde el contacto es el remitente o destinatario
        return msgFromPhone === currentPhone || msgToPhone === currentPhone;
      });
      
      console.log(`✅ Mensajes filtrados: ${allKapsoMessagesForPhone.length}`);
      
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
        
        console.log(`  - Convirtiendo mensaje ${kapsoMsg.id}:`);
        console.log(`    * isFromContact: ${isFromContact}`);
        console.log(`    * isToContact: ${isToContact}`);
        console.log(`    * messageType: ${messageType}`);
        
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
    
    // Combinar ambos sistemas
    const systemMessages = messagesByContact[normalizedPhone] || [];
    const allMessages = [...systemMessages];
    const existingIds = new Set(systemMessages.map(msg => msg.id));
    
    kapsoMessagesForContact.forEach(kapsoMsg => {
      if (!existingIds.has(kapsoMsg.id)) {
        allMessages.push(kapsoMsg);
      }
    });
    
    console.log('\n📱 [DEBUG] 4. Resultado final:');
    console.log(`  - Mensajes del sistema anterior: ${systemMessages.length}`);
    console.log(`  - Mensajes de Kapso convertidos: ${kapsoMessagesForContact.length}`);
    console.log(`  - Total de mensajes: ${allMessages.length}`);
    
    if (allMessages.length > 0) {
      console.log('\n📱 [DEBUG] 5. Mensajes finales:');
      allMessages.forEach(msg => {
        console.log(`  - ID: ${msg.id}, Type: ${msg.type}, Content: "${msg.content}", Timestamp: ${msg.timestamp}`);
      });
    } else {
      console.log('\n❌ [DEBUG] No se encontraron mensajes para mostrar');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugFrontendMatching();
