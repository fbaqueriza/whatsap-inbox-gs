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

async function debugContactList() {
  console.log('🔍 [DEBUG] Verificando lista de contactos...\n');

  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50';
  const phoneNumber = '5491135562673';

  try {
    // 1. Obtener proveedores
    console.log('📱 [DEBUG] 1. Obteniendo proveedores...');
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .eq('user_id', userId);

    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
    } else {
      console.log(`✅ Proveedores encontrados: ${providers.length}`);
      providers.forEach(provider => {
        console.log(`  - ID: ${provider.id}, Name: ${provider.name}, Phone: ${provider.phone}`);
      });
    }

    // 2. Obtener contactos del sistema anterior (whatsapp_messages)
    console.log('\n📱 [DEBUG] 2. Obteniendo contactos del sistema anterior...');
    const { data: oldMessages, error: oldError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (oldError) {
      console.error('❌ Error obteniendo mensajes del sistema anterior:', oldError);
    } else {
      console.log(`✅ Mensajes del sistema anterior: ${oldMessages.length}`);
      
      // Extraer contactos únicos
      const oldContacts = new Map();
      oldMessages.forEach(msg => {
        const phone = msg.from_number || msg.to_number;
        if (phone && !oldContacts.has(phone)) {
          oldContacts.set(phone, {
            phone: phone,
            name: phone, // Nombre por defecto
            lastMessage: msg.content,
            lastMessageTime: msg.timestamp,
            unreadCount: 0
          });
        }
      });
      
      console.log(`✅ Contactos del sistema anterior: ${oldContacts.size}`);
      oldContacts.forEach((contact, phone) => {
        console.log(`  - Phone: ${phone}, Name: ${contact.name}, Last Message: "${contact.lastMessage}"`);
      });
    }

    // 3. Obtener conversaciones de Kapso
    console.log('\n📱 [DEBUG] 3. Obteniendo conversaciones de Kapso...');
    const { data: kapsoConversations, error: convError } = await supabase
      .from('kapso_conversations')
      .select('*')
      .eq('user_id', userId);

    if (convError) {
      console.error('❌ Error obteniendo conversaciones de Kapso:', convError);
    } else {
      console.log(`✅ Conversaciones de Kapso: ${kapsoConversations.length}`);
      kapsoConversations.forEach(conv => {
        console.log(`  - ID: ${conv.id}, Phone: ${conv.phone_number}, Name: ${conv.contact_name}`);
      });
    }

    // 4. Simular la lógica de combinación de contactos del frontend
    console.log('\n📱 [DEBUG] 4. Simulando combinación de contactos...');
    
    const allContacts = [];
    
    // PASO 1: Incluir contactos del sistema anterior
    if (oldMessages && oldMessages.length > 0) {
      const oldContacts = new Map();
      oldMessages.forEach(msg => {
        const phone = msg.from_number || msg.to_number;
        if (phone && !oldContacts.has(phone)) {
          const normalizedPhone = normalizeContactIdentifier(phone);
          oldContacts.set(normalizedPhone, {
            id: phone,
            name: phone,
            phone: normalizedPhone,
            lastMessage: msg.content,
            lastMessageTime: new Date(msg.timestamp),
            unreadCount: 0
          });
        }
      });
      
      oldContacts.forEach(contact => {
        allContacts.push(contact);
      });
    }
    
    // PASO 2: Agregar proveedores
    if (providers && providers.length > 0) {
      providers.forEach(provider => {
        const normalizedPhone = normalizeContactIdentifier(provider.phone);
        const existingContact = allContacts.find(c => c.phone === normalizedPhone);
        
        if (!existingContact) {
          const providerDisplayName = provider.contact_name 
            ? `${provider.name} - ${provider.contact_name}`
            : provider.name;
          
          allContacts.push({
            id: provider.id,
            name: providerDisplayName,
            phone: normalizedPhone,
            providerId: provider.id,
            lastMessage: '',
            lastMessageTime: new Date(),
            unreadCount: 0
          });
        } else {
          const providerDisplayName = provider.contact_name 
            ? `${provider.name} - ${provider.contact_name}`
            : provider.name;
          
          existingContact.name = providerDisplayName;
          existingContact.providerId = provider.id;
        }
      });
    }
    
    // PASO 3: Agregar contactos de Kapso
    if (kapsoConversations && kapsoConversations.length > 0) {
      kapsoConversations.forEach(conversation => {
        const normalizedPhone = normalizeContactIdentifier(conversation.phone_number);
        const existingContact = allContacts.find(c => c.phone === normalizedPhone);
        
        if (!existingContact) {
          allContacts.push({
            id: conversation.id,
            name: conversation.contact_name || conversation.phone_number,
            phone: normalizedPhone,
            lastMessage: '',
            lastMessageTime: new Date(conversation.last_message_at),
            unreadCount: 0,
            isKapsoContact: true
          });
        } else {
          existingContact.lastMessage = existingContact.lastMessage || '';
          existingContact.lastMessageTime = new Date(conversation.last_message_at);
          existingContact.isKapsoContact = true;
        }
      });
    }
    
    console.log(`✅ Total de contactos combinados: ${allContacts.length}`);
    allContacts.forEach(contact => {
      console.log(`  - ID: ${contact.id}, Name: ${contact.name}, Phone: ${contact.phone}, isKapsoContact: ${contact.isKapsoContact || false}`);
    });

    // 5. Verificar si el contacto específico está en la lista
    console.log('\n📱 [DEBUG] 5. Verificando contacto específico...');
    const targetPhone = normalizeContactIdentifier(phoneNumber);
    console.log(`  - Número objetivo: ${phoneNumber}`);
    console.log(`  - Número normalizado: ${targetPhone}`);
    
    const targetContact = allContacts.find(c => c.phone === targetPhone);
    if (targetContact) {
      console.log(`✅ Contacto encontrado: ${targetContact.name} (${targetContact.phone})`);
      console.log(`  - ID: ${targetContact.id}`);
      console.log(`  - isKapsoContact: ${targetContact.isKapsoContact || false}`);
      console.log(`  - providerId: ${targetContact.providerId || 'N/A'}`);
    } else {
      console.log(`❌ Contacto NO encontrado en la lista`);
      console.log(`  - Contactos disponibles:`);
      allContacts.forEach(contact => {
        console.log(`    * ${contact.phone} (${contact.name})`);
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugContactList();
