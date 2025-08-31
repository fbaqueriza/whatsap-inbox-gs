require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticarMensajesRecientes() {
  console.log('🔍 DIAGNÓSTICO DE MENSAJES RECIENTES\n');

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
    
    // 2. Verificar mensajes más recientes en la base de datos
    console.log('\n🗄️ 2. VERIFICANDO MENSAJES MÁS RECIENTES EN DB');
    const { data: mensajesRecientes, error: errorDB } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (errorDB) {
      console.error('❌ Error obteniendo mensajes recientes:', errorDB);
      return;
    }
    
    // Agrupar por fecha (últimas 24 horas)
    const ahora = new Date();
    const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    
    const mensajesUltimas24h = mensajesRecientes.filter(m => 
      new Date(m.created_at) > hace24Horas
    );
    
    const mensajesRecibidos24h = mensajesUltimas24h.filter(m => m.message_type === 'received');
    const mensajesEnviados24h = mensajesUltimas24h.filter(m => m.message_type === 'sent');
    
    console.log(`✅ Mensajes en las últimas 24 horas: ${mensajesUltimas24h.length}`);
    console.log(`📥 Mensajes recibidos (24h): ${mensajesRecibidos24h.length}`);
    console.log(`📤 Mensajes enviados (24h): ${mensajesEnviados24h.length}`);
    
    // 3. Verificar mensajes del usuario específico en las últimas 24 horas
    console.log('\n👤 3. VERIFICANDO MENSAJES DEL USUARIO EN ÚLTIMAS 24H');
    const { data: userMessages24h, error: userMessagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', testUserId)
      .gte('created_at', hace24Horas.toISOString())
      .order('created_at', { ascending: false });
    
    if (userMessagesError) {
      console.error('❌ Error obteniendo mensajes del usuario:', userMessagesError);
      return;
    }
    
    const userReceived24h = userMessages24h.filter(m => m.message_type === 'received');
    const userSent24h = userMessages24h.filter(m => m.message_type === 'sent');
    
    console.log(`✅ Mensajes del usuario en 24h: ${userMessages24h.length}`);
    console.log(`📥 Mensajes recibidos del usuario: ${userReceived24h.length}`);
    console.log(`📤 Mensajes enviados del usuario: ${userSent24h.length}`);
    
    // 4. Verificar proveedores del usuario
    console.log('\n📞 4. VERIFICANDO PROVEEDORES DEL USUARIO');
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
    
    // 5. Verificar mensajes sin user_id en las últimas 24 horas
    console.log('\n❓ 5. VERIFICANDO MENSAJES SIN USER_ID EN ÚLTIMAS 24H');
    const { data: mensajesSinUserId24h, error: sinUserIdError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .is('user_id', null)
      .gte('created_at', hace24Horas.toISOString())
      .order('created_at', { ascending: false });
    
    if (sinUserIdError) {
      console.error('❌ Error obteniendo mensajes sin user_id:', sinUserIdError);
      return;
    }
    
    console.log(`❓ Mensajes sin user_id en 24h: ${mensajesSinUserId24h.length}`);
    
    if (mensajesSinUserId24h.length > 0) {
      console.log('\n📝 Mensajes sin user_id (últimas 24h):');
      mensajesSinUserId24h.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        console.log(`  ${i + 1}. ${fecha} - contact_id: ${msg.contact_id}, content: ${msg.content?.substring(0, 30)}...`);
      });
    }
    
    // 6. Verificar mensajes del proveedor específico en las últimas 24 horas
    console.log('\n📱 6. VERIFICANDO MENSAJES DEL PROVEEDOR ESPECÍFICO');
    if (userProviders.length > 0) {
      const proveedorPrincipal = userProviders[0].phone;
      console.log(`🔍 Buscando mensajes del proveedor: ${proveedorPrincipal}`);
      
      const { data: mensajesProveedor24h, error: proveedorError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('contact_id', proveedorPrincipal)
        .gte('created_at', hace24Horas.toISOString())
        .order('created_at', { ascending: false });
      
      if (proveedorError) {
        console.error('❌ Error obteniendo mensajes del proveedor:', proveedorError);
      } else {
        const recibidosProveedor = mensajesProveedor24h.filter(m => m.message_type === 'received');
        const enviadosProveedor = mensajesProveedor24h.filter(m => m.message_type === 'sent');
        
        console.log(`✅ Mensajes del proveedor en 24h: ${mensajesProveedor24h.length}`);
        console.log(`📥 Mensajes recibidos del proveedor: ${recibidosProveedor.length}`);
        console.log(`📤 Mensajes enviados del proveedor: ${enviadosProveedor.length}`);
        
        if (mensajesProveedor24h.length > 0) {
          console.log('\n📝 Últimos mensajes del proveedor:');
          mensajesProveedor24h.slice(0, 5).forEach((msg, i) => {
            const fecha = new Date(msg.created_at).toLocaleString('es-AR');
            const tieneUserId = msg.user_id ? '✅' : '❌';
            console.log(`  ${i + 1}. ${fecha} ${tieneUserId} user_id: ${msg.user_id || 'null'}, content: ${msg.content?.substring(0, 30)}...`);
          });
        }
      }
    }
    
    // 7. Análisis del problema
    console.log('\n🔍 7. ANÁLISIS DEL PROBLEMA');
    
    if (mensajesSinUserId24h.length > 0) {
      console.log('❌ PROBLEMA IDENTIFICADO: Hay mensajes recientes sin user_id asignado');
      console.log('💡 SOLUCIÓN: Ejecutar asignación de user_id para mensajes recientes');
    } else if (userReceived24h.length === 0) {
      console.log('❌ PROBLEMA IDENTIFICADO: No hay mensajes recibidos recientes');
      console.log('💡 POSIBLE CAUSA: Webhook no está funcionando o proveedor no está enviando mensajes');
    } else {
      console.log('✅ No se detectaron problemas evidentes con mensajes recientes');
      console.log('💡 El problema puede estar en el filtrado del frontend o en la API');
    }
    
    // 8. Recomendaciones
    console.log('\n📋 8. RECOMENDACIONES');
    if (mensajesSinUserId24h.length > 0) {
      console.log('1. 🔧 Ejecutar asignación de user_id para mensajes recientes');
    }
    console.log('2. 🔍 Verificar que el webhook esté funcionando correctamente');
    console.log('3. 📱 Verificar que el proveedor esté enviando mensajes al número correcto');
    console.log('4. 🔄 Verificar que el filtrado en tiempo real esté funcionando');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnosticarMensajesRecientes();
