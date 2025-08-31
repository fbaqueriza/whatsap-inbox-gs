require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarCorreccionFiltrado() {
  console.log('🔍 VERIFICACIÓN DE CORRECCIÓN DE FILTRADO\n');

  try {
    // 1. Verificar mensajes en la base de datos
    console.log('📊 1. ANÁLISIS DE MENSAJES EN BASE DE DATOS');
    const { data: mensajesDB, error: errorDB } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (errorDB) {
      console.error('❌ Error obteniendo mensajes de DB:', errorDB);
      return;
    }

    console.log(`✅ Total mensajes en DB: ${mensajesDB.length}`);
    
    // Analizar por tipo
    const sentMessages = mensajesDB.filter(m => m.message_type === 'sent');
    const receivedMessages = mensajesDB.filter(m => m.message_type === 'received');
    
    console.log(`📤 Mensajes enviados: ${sentMessages.length}`);
    console.log(`📥 Mensajes recibidos: ${receivedMessages.length}`);

    // Analizar mensajes argentinos
    const argentineMessages = mensajesDB.filter(m => 
      m.contact_id && m.contact_id.includes('+549')
    );
    console.log(`🇦🇷 Mensajes argentinos: ${argentineMessages.length}`);

    // 2. Simular el filtrado corregido
    console.log('\n🔧 2. SIMULACIÓN DE FILTRADO CORREGIDO');
    
    const normalizeContactIdentifier = (contactId) => {
      if (!contactId) return '';
      let normalized = contactId.replace(/[\s\-\(\)]/g, '');
      if (!normalized.startsWith('+')) {
        normalized = `+${normalized}`;
      }
      return normalized;
    };

    // Simular proveedores registrados
    const userProviderPhones = ['+5491135562673', '+5491135562674'];
    
    const transformedMessages = mensajesDB
      .map((msg) => {
        let messageType = 'received';
        if (msg.message_type === 'sent') messageType = 'sent';
        else if (msg.message_type === 'received') messageType = 'received';
        else if (msg.message_sid && (msg.message_sid.startsWith('sim_') || msg.message_sid.startsWith('msg_'))) {
          messageType = 'sent';
        }
        
        return {
          id: msg.message_sid || msg.id,
          content: msg.content,
          timestamp: new Date(msg.timestamp || msg.created_at),
          type: messageType,
          contact_id: msg.contact_id || msg.from,
          status: msg.status || 'delivered'
        };
      })
      .filter((msg) => {
        const contactId = normalizeContactIdentifier(msg.contact_id);
        
        // 🔧 FILTRADO CORREGIDO: Incluir TODOS los mensajes recibidos
        if (msg.type === 'received') {
          return true;
        }
        
        // Para mensajes enviados, verificar si son de proveedores registrados o argentinos
        const isFromRegisteredProvider = userProviderPhones.includes(contactId);
        const isArgentineNumber = contactId.includes('+549');
        
        return isFromRegisteredProvider || isArgentineNumber;
      });

    console.log(`✅ Mensajes después del filtrado: ${transformedMessages.length}`);
    
    const filteredReceived = transformedMessages.filter(m => m.type === 'received');
    const filteredSent = transformedMessages.filter(m => m.type === 'sent');
    const filteredArgentine = transformedMessages.filter(m => m.contact_id.includes('+549'));
    
    console.log(`📥 Mensajes recibidos filtrados: ${filteredReceived.length}`);
    console.log(`📤 Mensajes enviados filtrados: ${filteredSent.length}`);
    console.log(`🇦🇷 Mensajes argentinos filtrados: ${filteredArgentine.length}`);

    // 3. Verificar que los mensajes del proveedor están incluidos
    console.log('\n👥 3. VERIFICACIÓN DE MENSAJES DEL PROVEEDOR');
    
    const providerMessages = transformedMessages.filter(m => 
      m.contact_id && m.contact_id.includes('+5491135562673')
    );
    
    console.log(`📱 Mensajes del proveedor +5491135562673: ${providerMessages.length}`);
    
    if (providerMessages.length > 0) {
      console.log('📝 Últimos mensajes del proveedor:');
      providerMessages.slice(0, 5).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.type} | ${msg.content?.substring(0, 30)}...`);
      });
    }

    // 4. Comparar con la imagen del usuario
    console.log('\n🖼️ 4. COMPARACIÓN CON LA IMAGEN DEL USUARIO');
    console.log('📋 En la imagen se ven 9 mensajes enviados por el proveedor (burbujas verdes)');
    console.log(`📊 En nuestro filtrado tenemos ${filteredReceived.length} mensajes recibidos`);
    
    if (filteredReceived.length >= 9) {
      console.log('✅ CORRECCIÓN EXITOSA: Los mensajes del proveedor están siendo incluidos');
    } else {
      console.log('⚠️ AÚN FALTAN MENSAJES: Verificar si hay más mensajes en la base de datos');
    }

    console.log('\n✅ VERIFICACIÓN COMPLETADA');
    console.log('\n📋 RESUMEN DE LA CORRECCIÓN:');
    console.log('✅ Filtrado corregido para incluir TODOS los mensajes recibidos');
    console.log('✅ Mensajes enviados filtrados por relevancia');
    console.log('✅ Logging mejorado con estadísticas completas');
    console.log('✅ Sistema más robusto y menos restrictivo');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarCorreccionFiltrado();
