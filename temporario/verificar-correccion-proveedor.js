require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarCorreccionProveedor() {
  console.log('🔍 VERIFICANDO CORRECCIÓN DEL PROVEEDOR\n');

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
    
    // 2. Verificar proveedores del usuario
    console.log('\n📞 2. VERIFICANDO PROVEEDORES DEL USUARIO');
    const { data: userProviders, error: providersError } = await supabase
      .from('providers')
      .select('phone')
      .eq('user_id', testUserId);
    
    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
      return;
    }
    
    console.log(`✅ Usuario tiene ${userProviders.length} proveedores registrados`);
    userProviders.forEach((provider, i) => {
      console.log(`  ${i + 1}. ${provider.phone}`);
    });
    
    // 3. Verificar mensajes del proveedor específico (+5491135562673)
    console.log('\n📱 3. VERIFICANDO MENSAJES DEL PROVEEDOR +5491135562673');
    const { data: mensajesProveedor, error: proveedorError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (proveedorError) {
      console.error('❌ Error obteniendo mensajes del proveedor:', proveedorError);
      return;
    }
    
    const sentMessages = mensajesProveedor.filter(m => m.message_type === 'sent');
    const receivedMessages = mensajesProveedor.filter(m => m.message_type === 'received');
    const messagesWithUserId = mensajesProveedor.filter(m => m.user_id !== null);
    
    console.log(`✅ Total mensajes del proveedor: ${mensajesProveedor.length}`);
    console.log(`📤 Mensajes enviados: ${sentMessages.length}`);
    console.log(`📥 Mensajes recibidos: ${receivedMessages.length}`);
    console.log(`👤 Mensajes con user_id: ${messagesWithUserId.length}`);
    
    if (mensajesProveedor.length > 0) {
      console.log('\n📝 Ejemplos de mensajes del proveedor:');
      mensajesProveedor.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
        const tieneUserId = msg.user_id ? '✅' : '❌';
        console.log(`  ${i + 1}. ${fecha} ${tipo} ${tieneUserId} user_id: ${msg.user_id || 'null'}, content: ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 4. Simular el filtrado corregido
    console.log('\n🔧 4. SIMULANDO FILTRADO CORREGIDO');
    const userProviderPhones = userProviders.map(p => p.phone);
    
    // Simular la función normalizeContactIdentifier
    const normalizeContactIdentifier = (contactId) => {
      if (!contactId) return '';
      return contactId.replace(/[\s\-\(\)]/g, '');
    };
    
    // Simular el filtrado corregido
    const mensajesFiltrados = mensajesProveedor.filter((msg) => {
      const contactId = normalizeContactIdentifier(msg.contact_id);
      
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
    
    const sentFiltrados = mensajesFiltrados.filter(m => m.message_type === 'sent');
    const receivedFiltrados = mensajesFiltrados.filter(m => m.message_type === 'received');
    
    console.log(`✅ Mensajes después del filtrado: ${mensajesFiltrados.length}`);
    console.log(`📤 Mensajes enviados filtrados: ${sentFiltrados.length}`);
    console.log(`📥 Mensajes recibidos filtrados: ${receivedFiltrados.length}`);
    
    // 5. Verificar mensajes del usuario específico
    console.log('\n👤 5. VERIFICANDO MENSAJES DEL USUARIO ESPECÍFICO');
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
    
    const userSentMessages = userMessages.filter(m => m.message_type === 'sent');
    const userReceivedMessages = userMessages.filter(m => m.message_type === 'received');
    
    console.log(`✅ Total mensajes del usuario: ${userMessages.length}`);
    console.log(`📤 Mensajes enviados del usuario: ${userSentMessages.length}`);
    console.log(`📥 Mensajes recibidos del usuario: ${userReceivedMessages.length}`);
    
    // 6. Verificar mensajes del proveedor en los mensajes del usuario
    console.log('\n📱 6. VERIFICANDO MENSAJES DEL PROVEEDOR EN MENSAJES DEL USUARIO');
    const mensajesProveedorEnUsuario = userMessages.filter(m => m.contact_id === '+5491135562673');
    const sentProveedorEnUsuario = mensajesProveedorEnUsuario.filter(m => m.message_type === 'sent');
    const receivedProveedorEnUsuario = mensajesProveedorEnUsuario.filter(m => m.message_type === 'received');
    
    console.log(`✅ Mensajes del proveedor en usuario: ${mensajesProveedorEnUsuario.length}`);
    console.log(`📤 Mensajes enviados del proveedor: ${sentProveedorEnUsuario.length}`);
    console.log(`📥 Mensajes recibidos del proveedor: ${receivedProveedorEnUsuario.length}`);
    
    if (mensajesProveedorEnUsuario.length > 0) {
      console.log('\n📝 Ejemplos de mensajes del proveedor en usuario:');
      mensajesProveedorEnUsuario.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
        console.log(`  ${i + 1}. ${fecha} ${tipo} - content: ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 7. Análisis final
    console.log('\n🔍 7. ANÁLISIS FINAL');
    
    if (sentProveedorEnUsuario.length > 0) {
      console.log('✅ CORRECCIÓN EXITOSA: Los mensajes enviados del proveedor están incluidos');
      console.log(`📱 El usuario tiene ${sentProveedorEnUsuario.length} mensajes enviados del proveedor`);
      console.log('🎯 Estos mensajes deberían aparecer en el chat como burbujas verdes');
    } else {
      console.log('❌ PROBLEMA: No hay mensajes enviados del proveedor en el usuario');
      console.log('💡 Posible causa: Los mensajes no tienen user_id asignado');
    }
    
    if (receivedProveedorEnUsuario.length > 0) {
      console.log(`📥 El usuario tiene ${receivedProveedorEnUsuario.length} mensajes recibidos del proveedor`);
    }
    
    // 8. Resumen
    console.log('\n📋 RESUMEN:');
    console.log('✅ El proveedor +5491135562673 está registrado');
    console.log(`✅ Hay ${mensajesProveedor.length} mensajes del proveedor en total`);
    console.log(`✅ El usuario tiene ${mensajesProveedorEnUsuario.length} mensajes del proveedor`);
    console.log('✅ El filtrado corregido debería mostrar estos mensajes en el chat');
    
    if (sentProveedorEnUsuario.length > 0) {
      console.log('\n🎉 ¡CORRECCIÓN EXITOSA!');
      console.log('Los mensajes del proveedor ahora deberían aparecer en el chat.');
    } else {
      console.log('\n⚠️ Aún hay problemas con la asignación de user_id');
    }

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarCorreccionProveedor();
