require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticarFiltradoFrontend() {
  console.log('🔍 DIAGNÓSTICO DE FILTRADO EN FRONTEND\n');

  try {
    // 1. Obtener mensajes de la API (como lo hace el frontend)
    console.log('📊 1. SIMULANDO LLAMADA A LA API DEL FRONTEND');
    
    // Simular la llamada que hace el frontend
    const response = await fetch('http://localhost:3001/api/whatsapp/messages?limit=20&userId=test');
    const data = await response.json();
    
    if (!data.messages) {
      console.log('❌ No se pudo obtener mensajes de la API');
      return;
    }
    
    console.log(`✅ API devuelve: ${data.messages.length} mensajes`);
    
    // 2. Analizar los mensajes antes del filtrado
    console.log('\n📋 2. ANÁLISIS ANTES DEL FILTRADO');
    const sentMessages = data.messages.filter(m => m.message_type === 'sent');
    const receivedMessages = data.messages.filter(m => m.message_type === 'received');
    
    console.log(`📤 Mensajes enviados en API: ${sentMessages.length}`);
    console.log(`📥 Mensajes recibidos en API: ${receivedMessages.length}`);
    
    // Mostrar algunos ejemplos
    console.log('\n📝 Ejemplos de mensajes recibidos:');
    receivedMessages.slice(0, 3).forEach((msg, i) => {
      console.log(`  ${i + 1}. message_type: ${msg.message_type}, contact_id: ${msg.contact_id}, content: ${msg.content?.substring(0, 30)}...`);
    });
    
    // 3. Simular el mapeo del frontend
    console.log('\n🔄 3. SIMULANDO MAPEO DEL FRONTEND');
    
    const normalizeContactIdentifier = (contactId) => {
      if (!contactId) return '';
      let normalized = contactId.replace(/[\s\-\(\)]/g, '');
      if (!normalized.startsWith('+')) {
        normalized = `+${normalized}`;
      }
      return normalized;
    };
    
    const mappedMessages = data.messages.map((msg) => {
      let messageType = 'received';
      
      if (msg.message_type === 'sent') {
        messageType = 'sent';
      } else if (msg.message_type === 'received') {
        messageType = 'received';
      } else if (msg.message_sid && (msg.message_sid.startsWith('sim_') || msg.message_sid.startsWith('msg_'))) {
        messageType = 'sent';
      }
      
      return {
        id: msg.message_sid || msg.id,
        content: msg.content,
        timestamp: new Date(msg.timestamp || msg.created_at),
        type: messageType,
        contact_id: msg.contact_id || msg.from,
        status: msg.status || 'delivered',
        // 🔧 MANTENER EL ORIGINAL PARA DEBUG
        original_message_type: msg.message_type
      };
    });
    
    console.log(`✅ Mensajes mapeados: ${mappedMessages.length}`);
    const mappedReceived = mappedMessages.filter(m => m.type === 'received');
    const mappedSent = mappedMessages.filter(m => m.type === 'sent');
    console.log(`📥 Mapeados como recibidos: ${mappedReceived.length}`);
    console.log(`📤 Mapeados como enviados: ${mappedSent.length}`);
    
    // 4. Simular el filtrado del frontend
    console.log('\n🔧 4. SIMULANDO FILTRADO DEL FRONTEND');
    
    // Simular proveedores registrados
    const userProviderPhones = ['+5491135562673', '+5491135562674'];
    
    const filteredMessages = mappedMessages.filter((msg) => {
      const contactId = normalizeContactIdentifier(msg.contact_id);
      
      // 🔧 CORRECCIÓN: Incluir TODOS los mensajes recibidos
      if (msg.original_message_type === 'received') {
        console.log(`✅ Incluyendo mensaje recibido: ${msg.content?.substring(0, 30)}...`);
        return true;
      }
      
      // Para mensajes enviados, verificar si son de proveedores registrados o argentinos
      const isFromRegisteredProvider = userProviderPhones.includes(contactId);
      const isArgentineNumber = contactId.includes('+549');
      
      const shouldInclude = isFromRegisteredProvider || isArgentineNumber;
      
      if (shouldInclude) {
        console.log(`✅ Incluyendo mensaje enviado: ${msg.content?.substring(0, 30)}...`);
      } else {
        console.log(`❌ Excluyendo mensaje: ${msg.content?.substring(0, 30)}... (contact_id: ${contactId})`);
      }
      
      return shouldInclude;
    });
    
    console.log(`\n✅ Mensajes después del filtrado: ${filteredMessages.length}`);
    
    const filteredReceived = filteredMessages.filter(m => m.type === 'received');
    const filteredSent = filteredMessages.filter(m => m.type === 'sent');
    
    console.log(`📥 Mensajes recibidos filtrados: ${filteredReceived.length}`);
    console.log(`📤 Mensajes enviados filtrados: ${filteredSent.length}`);
    
    // 5. Comparar con el console del frontend
    console.log('\n🖥️ 5. COMPARACIÓN CON CONSOLE DEL FRONTEND');
    console.log(`Frontend muestra: 4 mensajes totales (0 recibidos, 4 enviados, 4 argentinos)`);
    console.log(`Nuestro filtrado: ${filteredMessages.length} mensajes totales (${filteredReceived.length} recibidos, ${filteredSent.length} enviados)`);
    
    if (filteredReceived.length === 0) {
      console.log('❌ PROBLEMA IDENTIFICADO: El filtrado no está incluyendo mensajes recibidos');
      console.log('🔍 Posibles causas:');
      console.log('  1. Los mensajes no tienen message_type === "received"');
      console.log('  2. El filtrado se está aplicando incorrectamente');
      console.log('  3. Los datos de la API no coinciden con la base de datos');
    } else {
      console.log('✅ El filtrado está funcionando correctamente');
    }
    
    // 6. Verificar directamente en la base de datos
    console.log('\n🗄️ 6. VERIFICACIÓN DIRECTA EN BASE DE DATOS');
    const { data: mensajesDB, error: errorDB } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('message_type', 'received')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (errorDB) {
      console.error('❌ Error obteniendo mensajes recibidos de DB:', errorDB);
    } else {
      console.log(`✅ Base de datos tiene ${mensajesDB.length} mensajes recibidos`);
      mensajesDB.slice(0, 3).forEach((msg, i) => {
        console.log(`  ${i + 1}. message_type: ${msg.message_type}, contact_id: ${msg.contact_id}, content: ${msg.content?.substring(0, 30)}...`);
      });
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnosticarFiltradoFrontend();
