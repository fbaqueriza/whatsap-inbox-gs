require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticarMensajesFaltantes() {
  console.log('🔍 DIAGNOSTICANDO MENSAJES FALTANTES DEL PROVEEDOR\n');

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
    
    // 2. Obtener TODOS los mensajes del proveedor +5491135562673
    console.log('\n📱 2. OBTENIENDO TODOS LOS MENSAJES DEL PROVEEDOR +5491135562673');
    
    // Buscar mensajes donde el contact_id sea el proveedor
    const { data: mensajesProveedor, error: mensajesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .or(`contact_id.eq.+5491135562673,contact_id.eq.5491135562673`)
      .order('created_at', { ascending: false });
    
    if (mensajesError) {
      console.error('❌ Error obteniendo mensajes del proveedor:', mensajesError);
      return;
    }
    
    console.log(`✅ Total mensajes del proveedor en BD: ${mensajesProveedor.length}`);
    
    // 3. Analizar mensajes por tipo y user_id
    console.log('\n📊 3. ANÁLISIS DETALLADO DE MENSAJES');
    
    const mensajesConUserId = mensajesProveedor.filter(msg => msg.user_id);
    const mensajesSinUserId = mensajesProveedor.filter(msg => !msg.user_id);
    
    console.log(`📥 Mensajes CON user_id: ${mensajesConUserId.length}`);
    console.log(`❌ Mensajes SIN user_id: ${mensajesSinUserId.length}`);
    
    // 4. Analizar por message_type
    const mensajesRecibidos = mensajesProveedor.filter(msg => msg.message_type === 'received');
    const mensajesEnviados = mensajesProveedor.filter(msg => msg.message_type === 'sent');
    
    console.log(`📥 Mensajes recibidos: ${mensajesRecibidos.length}`);
    console.log(`📤 Mensajes enviados: ${mensajesEnviados.length}`);
    
    // 5. Mostrar ejemplos de mensajes sin user_id
    if (mensajesSinUserId.length > 0) {
      console.log('\n📝 EJEMPLOS DE MENSAJES SIN USER_ID:');
      mensajesSinUserId.slice(0, 10).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
        const user_id = msg.user_id ? `user_id: ${msg.user_id}` : 'user_id: NULL';
        console.log(`  ${i + 1}. ${fecha} ${tipo} - ${user_id} - content: ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 6. Verificar mensajes del usuario específico
    console.log('\n👤 4. VERIFICANDO MENSAJES DEL USUARIO ESPECÍFICO');
    const mensajesDelUsuario = mensajesProveedor.filter(msg => msg.user_id === testUserId);
    const mensajesRecibidosDelUsuario = mensajesDelUsuario.filter(msg => msg.message_type === 'received');
    const mensajesEnviadosDelUsuario = mensajesDelUsuario.filter(msg => msg.message_type === 'sent');
    
    console.log(`📱 Mensajes del usuario ${testUserId}: ${mensajesDelUsuario.length}`);
    console.log(`📥 Mensajes recibidos del usuario: ${mensajesRecibidosDelUsuario.length}`);
    console.log(`📤 Mensajes enviados del usuario: ${mensajesEnviadosDelUsuario.length}`);
    
    // 7. Verificar mensajes de otros usuarios
    const otrosUsuarios = [...new Set(mensajesProveedor.filter(msg => msg.user_id && msg.user_id !== testUserId).map(msg => msg.user_id))];
    console.log(`👥 Otros usuarios con mensajes del proveedor: ${otrosUsuarios.length}`);
    otrosUsuarios.forEach((userId, i) => {
      const mensajesOtroUsuario = mensajesProveedor.filter(msg => msg.user_id === userId);
      console.log(`  ${i + 1}. ${userId}: ${mensajesOtroUsuario.length} mensajes`);
    });
    
    // 8. Análisis de fechas
    console.log('\n📅 5. ANÁLISIS DE FECHAS');
    const mensajesRecientes = mensajesProveedor.filter(msg => {
      const fecha = new Date(msg.created_at);
      const ahora = new Date();
      const diferenciaDias = (ahora - fecha) / (1000 * 60 * 60 * 24);
      return diferenciaDias <= 7; // Últimos 7 días
    });
    
    console.log(`📅 Mensajes de los últimos 7 días: ${mensajesRecientes.length}`);
    
    // 9. Verificar si hay mensajes duplicados
    console.log('\n🔍 6. VERIFICANDO DUPLICADOS');
    const mensajesUnicos = new Map();
    const duplicados = [];
    
    mensajesProveedor.forEach(msg => {
      const clave = `${msg.content}_${msg.created_at}_${msg.message_type}`;
      if (mensajesUnicos.has(clave)) {
        duplicados.push(msg);
      } else {
        mensajesUnicos.set(clave, msg);
      }
    });
    
    console.log(`✅ Mensajes únicos: ${mensajesUnicos.size}`);
    console.log(`🔄 Mensajes duplicados: ${duplicados.length}`);
    
    // 10. Resumen del problema
    console.log('\n📋 RESUMEN DEL PROBLEMA:');
    console.log(`✅ Total mensajes del proveedor en BD: ${mensajesProveedor.length}`);
    console.log(`📥 Mensajes recibidos en BD: ${mensajesRecibidos.length}`);
    console.log(`📱 Mensajes del usuario actual: ${mensajesDelUsuario.length}`);
    console.log(`📥 Mensajes recibidos del usuario actual: ${mensajesRecibidosDelUsuario.length}`);
    
    // 11. Identificar el problema
    console.log('\n🔍 IDENTIFICACIÓN DEL PROBLEMA:');
    
    if (mensajesSinUserId.length > 0) {
      console.log('❌ PROBLEMA: Hay mensajes sin user_id asignado');
      console.log(`💡 Solución: Asignar user_id a ${mensajesSinUserId.length} mensajes`);
    }
    
    if (mensajesRecibidos.length > mensajesRecibidosDelUsuario.length) {
      console.log('❌ PROBLEMA: Hay mensajes recibidos que no pertenecen al usuario actual');
      console.log(`💡 Solución: Verificar asignación de user_id`);
    }
    
    if (mensajesDelUsuario.length === 0) {
      console.log('❌ PROBLEMA: No hay mensajes del proveedor asignados al usuario actual');
      console.log('💡 Solución: Asignar user_id a todos los mensajes del proveedor');
    }
    
    // 12. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('1. Ejecutar script de asignación de user_id para mensajes sin asignar');
    console.log('2. Verificar que todos los mensajes del proveedor tengan user_id correcto');
    console.log('3. Revisar la lógica de filtrado en ChatContext');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnosticarMensajesFaltantes();
