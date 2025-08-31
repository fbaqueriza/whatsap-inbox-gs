require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarMensajesProveedor() {
  console.log('🔍 VERIFICANDO MENSAJES DEL PROVEEDOR\n');

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
    
    // 2. Verificar todos los mensajes del usuario
    console.log('\n📱 2. VERIFICANDO TODOS LOS MENSAJES DEL USUARIO');
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
    
    const sentMessages = userMessages.filter(m => m.message_type === 'sent');
    const receivedMessages = userMessages.filter(m => m.message_type === 'received');
    
    console.log(`✅ Total mensajes del usuario: ${userMessages.length}`);
    console.log(`📤 Mensajes enviados: ${sentMessages.length}`);
    console.log(`📥 Mensajes recibidos: ${receivedMessages.length}`);
    
    // 3. Analizar mensajes enviados
    console.log('\n📤 3. ANÁLISIS DE MENSAJES ENVIADOS');
    if (sentMessages.length > 0) {
      console.log('📝 Ejemplos de mensajes enviados:');
      sentMessages.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        console.log(`  ${i + 1}. ${fecha} - contact_id: ${msg.contact_id}, content: ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 4. Analizar mensajes recibidos
    console.log('\n📥 4. ANÁLISIS DE MENSAJES RECIBIDOS');
    if (receivedMessages.length > 0) {
      console.log('📝 Ejemplos de mensajes recibidos:');
      receivedMessages.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        console.log(`  ${i + 1}. ${fecha} - contact_id: ${msg.contact_id}, content: ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 5. Verificar mensajes del número problemático
    console.log('\n🔍 5. VERIFICANDO MENSAJES DEL NÚMERO PROBLEMÁTICO (+670680919470999)');
    const { data: mensajesProblematicos, error: problematicosError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+670680919470999')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (problematicosError) {
      console.error('❌ Error obteniendo mensajes problemáticos:', problematicosError);
    } else {
      const sentProblematicos = mensajesProblematicos.filter(m => m.message_type === 'sent');
      const receivedProblematicos = mensajesProblematicos.filter(m => m.message_type === 'received');
      
      console.log(`✅ Total mensajes del número problemático: ${mensajesProblematicos.length}`);
      console.log(`📤 Mensajes enviados: ${sentProblematicos.length}`);
      console.log(`📥 Mensajes recibidos: ${receivedProblematicos.length}`);
      
      if (mensajesProblematicos.length > 0) {
        console.log('\n📝 Ejemplos de mensajes del número problemático:');
        mensajesProblematicos.slice(0, 5).forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
          console.log(`  ${i + 1}. ${fecha} ${tipo} - user_id: ${msg.user_id || 'null'}, content: ${msg.content?.substring(0, 50)}...`);
        });
      }
    }
    
    // 6. Verificar proveedores registrados
    console.log('\n📞 6. VERIFICANDO PROVEEDORES REGISTRADOS');
    const { data: userProviders, error: providersError } = await supabase
      .from('providers')
      .select('phone')
      .eq('user_id', testUserId);
    
    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
    } else {
      console.log(`✅ Usuario tiene ${userProviders.length} proveedores registrados`);
      userProviders.forEach((provider, i) => {
        console.log(`  ${i + 1}. ${provider.phone}`);
      });
    }
    
    // 7. Análisis del problema
    console.log('\n🔍 7. ANÁLISIS DEL PROBLEMA');
    
    console.log('\n📋 RESUMEN DEL PROBLEMA:');
    console.log('1. 📱 Los mensajes en la imagen del WhatsApp son BURBUJAS VERDES (enviados por el proveedor)');
    console.log('2. 🔄 En nuestro sistema, estos mensajes se guardan como message_type: "sent"');
    console.log('3. 📥 Pero el webhook solo se activa cuando el proveedor ENVÍA mensajes (no cuando los recibe)');
    console.log('4. ❌ Por eso no vemos los mensajes del proveedor en el chat');
    
    console.log('\n💡 SOLUCIÓN NECESARIA:');
    console.log('1. 🔧 Los mensajes del proveedor deben guardarse como message_type: "received"');
    console.log('2. 📱 El webhook debe activarse cuando el proveedor ENVÍA mensajes');
    console.log('3. 🔄 Necesitamos cambiar la lógica del webhook para manejar esto correctamente');
    
    // 8. Verificar si hay mensajes del proveedor registrado
    console.log('\n📱 8. VERIFICANDO MENSAJES DEL PROVEEDOR REGISTRADO');
    if (userProviders.length > 0) {
      const proveedorRegistrado = userProviders[0].phone;
      console.log(`🔍 Buscando mensajes del proveedor registrado: ${proveedorRegistrado}`);
      
      const { data: mensajesProveedorRegistrado, error: proveedorRegistradoError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('contact_id', proveedorRegistrado)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (proveedorRegistradoError) {
        console.error('❌ Error obteniendo mensajes del proveedor registrado:', proveedorRegistradoError);
      } else {
        const sentProveedorRegistrado = mensajesProveedorRegistrado.filter(m => m.message_type === 'sent');
        const receivedProveedorRegistrado = mensajesProveedorRegistrado.filter(m => m.message_type === 'received');
        
        console.log(`✅ Mensajes del proveedor registrado: ${mensajesProveedorRegistrado.length}`);
        console.log(`📤 Mensajes enviados: ${sentProveedorRegistrado.length}`);
        console.log(`📥 Mensajes recibidos: ${receivedProveedorRegistrado.length}`);
        
        if (mensajesProveedorRegistrado.length === 0) {
          console.log('⚠️ No hay mensajes del proveedor registrado');
          console.log('💡 Esto confirma que el proveedor está usando un número diferente');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarMensajesProveedor();
