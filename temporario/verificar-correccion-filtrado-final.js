require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarCorreccionFiltradoFinal() {
  console.log('🔍 VERIFICANDO CORRECCIÓN DEL FILTRADO FINAL\n');

  try {
    // 1. Obtener usuario de prueba
    console.log('👤 1. OBTENIENDO USUARIO DE PRUEBA');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (usersError || !users.length) {
      console.log('❌ No se pudo obtener usuario de prueba');
      return;
    }
    
    const testUserId = users[0].id;
    console.log(`✅ Usuario de prueba: ${testUserId} (${users[0].email})`);
    
    // 2. Obtener proveedores del usuario
    console.log('\n📞 2. OBTENIENDO PROVEEDORES DEL USUARIO');
    const { data: userProviders, error: providersError } = await supabase
      .from('providers')
      .select('phone')
      .eq('user_id', testUserId);
    
    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
      return;
    }
    
    const userProviderPhones = userProviders.map(p => {
      let phone = p.phone;
      if (phone && !phone.startsWith('+')) {
        phone = `+${phone}`;
      }
      return phone;
    });
    
    console.log(`✅ Usuario tiene ${userProviders.length} proveedores registrados`);
    userProviderPhones.forEach((phone, i) => {
      console.log(`  ${i + 1}. ${phone}`);
    });
    
    // 3. Obtener mensajes del usuario
    console.log('\n📱 3. OBTENIENDO MENSAJES DEL USUARIO');
    const { data: userMessages, error: userMessagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (userMessagesError) {
      console.error('❌ Error obteniendo mensajes del usuario:', userMessagesError);
      return;
    }
    
    console.log(`✅ Total mensajes del usuario: ${userMessages.length}`);
    
    // 4. Simular el filtrado corregido
    console.log('\n🔧 4. SIMULANDO FILTRADO CORREGIDO');
    
    // Función de normalización
    const normalizeContactIdentifier = (contactId) => {
      if (!contactId) return '';
      let normalized = contactId.replace(/[\s\-\(\)]/g, '');
      if (!normalized.startsWith('+')) {
        normalized = `+${normalized}`;
      }
      return normalized;
    };
    
    // Aplicar filtrado ANTES del mapeo (como en la corrección)
    const filteredMessages = userMessages.filter((msg) => {
      const contactId = normalizeContactIdentifier(msg.contact_id || msg.from);
      
      // Incluir TODOS los mensajes recibidos
      if (msg.message_type === 'received') {
        return true;
      }
      
      // Para mensajes enviados, verificar si son de proveedores registrados
      const isFromRegisteredProvider = userProviderPhones.includes(contactId);
      
      // Incluir mensajes enviados del proveedor registrado
      if (msg.message_type === 'sent' && isFromRegisteredProvider) {
        return true;
      }
      
      // Para otros mensajes enviados, verificar si son argentinos
      const isArgentineNumber = contactId.includes('+549');
      
      return isArgentineNumber;
    });
    
    console.log(`✅ Mensajes después del filtrado: ${filteredMessages.length}`);
    
    // 5. Aplicar mapeo después del filtrado
    const transformedMessages = filteredMessages.map((msg) => {
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
        status: msg.status || 'delivered'
      };
    });
    
    // 6. Analizar resultados
    console.log('\n📊 5. ANÁLISIS DE RESULTADOS');
    const receivedMessages = transformedMessages.filter(m => m.type === 'received');
    const sentMessages = transformedMessages.filter(m => m.type === 'sent');
    const argentineMessages = transformedMessages.filter(m => 
      m.contact_id.includes('+549')
    );
    
    console.log(`✅ Mensajes transformados: ${transformedMessages.length}`);
    console.log(`📥 Mensajes recibidos: ${receivedMessages.length}`);
    console.log(`📤 Mensajes enviados: ${sentMessages.length}`);
    console.log(`🇦🇷 Mensajes argentinos: ${argentineMessages.length}`);
    
    // 7. Verificar mensajes del proveedor específico
    console.log('\n📱 6. VERIFICANDO MENSAJES DEL PROVEEDOR +5491135562673');
    const mensajesProveedor = transformedMessages.filter(m => m.contact_id === '+5491135562673');
    const sentProveedor = mensajesProveedor.filter(m => m.type === 'sent');
    const receivedProveedor = mensajesProveedor.filter(m => m.type === 'received');
    
    console.log(`✅ Mensajes del proveedor: ${mensajesProveedor.length}`);
    console.log(`📤 Mensajes enviados del proveedor: ${sentProveedor.length}`);
    console.log(`📥 Mensajes recibidos del proveedor: ${receivedProveedor.length}`);
    
    if (mensajesProveedor.length > 0) {
      console.log('\n📝 Ejemplos de mensajes del proveedor:');
      mensajesProveedor.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.timestamp).toLocaleString('es-AR');
        const tipo = msg.type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
        console.log(`  ${i + 1}. ${fecha} ${tipo} - content: ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 8. Verificar otros proveedores
    console.log('\n📞 7. VERIFICANDO OTROS PROVEEDORES');
    userProviderPhones.forEach((phone, i) => {
      const mensajesProveedor = transformedMessages.filter(m => m.contact_id === phone);
      const sentProveedor = mensajesProveedor.filter(m => m.type === 'sent');
      const receivedProveedor = mensajesProveedor.filter(m => m.type === 'received');
      
      console.log(`  ${i + 1}. ${phone}: ${mensajesProveedor.length} mensajes (${sentProveedor.length} enviados, ${receivedProveedor.length} recibidos)`);
    });
    
    // 9. Análisis final
    console.log('\n🔍 8. ANÁLISIS FINAL');
    
    if (sentProveedor.length > 0) {
      console.log('✅ CORRECCIÓN EXITOSA: Los mensajes enviados del proveedor están incluidos');
      console.log(`📱 El proveedor +5491135562673 tiene ${sentProveedor.length} mensajes enviados visibles`);
      console.log('🎯 Estos mensajes deberían aparecer en el chat como burbujas verdes');
    } else {
      console.log('❌ PROBLEMA: No hay mensajes enviados del proveedor');
      console.log('💡 Posible causa: Los mensajes no están siendo filtrados correctamente');
    }
    
    // 10. Resumen
    console.log('\n📋 RESUMEN:');
    console.log(`✅ Total mensajes originales: ${userMessages.length}`);
    console.log(`✅ Mensajes después del filtrado: ${filteredMessages.length}`);
    console.log(`✅ Mensajes transformados: ${transformedMessages.length}`);
    console.log(`✅ Mensajes del proveedor +5491135562673: ${mensajesProveedor.length}`);
    
    if (sentProveedor.length > 0) {
      console.log('\n🎉 ¡CORRECCIÓN EXITOSA!');
      console.log('El filtrado ahora funciona correctamente y los mensajes del proveedor están incluidos.');
    } else {
      console.log('\n⚠️ Aún hay problemas con el filtrado');
      console.log('💡 Revisar la lógica de filtrado o la asignación de user_id');
    }

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarCorreccionFiltradoFinal();
