require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarMensajeManual() {
  console.log('🔍 VERIFICANDO MENSAJE MANUAL\n');

  try {
    // 1. Buscar el mensaje manual recién creado
    console.log('📱 1. BUSCANDO MENSAJE MANUAL');
    
    const { data: mensajeManual, error: mensajeError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .like('message_sid', 'test_manual_%')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (mensajeError) {
      console.error('❌ Error buscando mensaje manual:', mensajeError);
      return;
    }
    
    if (mensajeManual.length > 0) {
      const mensaje = mensajeManual[0];
      console.log('✅ Mensaje manual encontrado:');
      console.log(`   - content: ${mensaje.content}`);
      console.log(`   - user_id: ${mensaje.user_id}`);
      console.log(`   - contact_id: ${mensaje.contact_id}`);
      console.log(`   - message_sid: ${mensaje.message_sid}`);
      console.log(`   - created_at: ${mensaje.created_at}`);
      console.log(`   - message_type: ${mensaje.message_type}`);
    } else {
      console.log('❌ No se encontró el mensaje manual');
    }
    
    // 2. Verificar todos los mensajes del proveedor
    console.log('\n📱 2. TODOS LOS MENSAJES DEL PROVEEDOR +5491135562673');
    
    const { data: todosMensajes, error: todosError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .order('created_at', { ascending: false });
    
    if (todosError) {
      console.error('❌ Error obteniendo todos los mensajes:', todosError);
    } else {
      console.log(`✅ Total de mensajes del proveedor: ${todosMensajes.length}`);
      
      if (todosMensajes.length > 0) {
        console.log('\n📝 MENSAJES RECIENTES:');
        todosMensajes.slice(0, 5).forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
          const user_id = msg.user_id ? `user_id: ${msg.user_id}` : 'user_id: NULL';
          console.log(`  ${i + 1}. ${fecha} ${tipo} - ${user_id} - content: ${msg.content?.substring(0, 50)}...`);
        });
      }
    }
    
    // 3. Verificar mensajes del webhook
    console.log('\n📱 3. MENSAJES DEL WEBHOOK');
    
    const { data: mensajesWebhook, error: webhookError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .like('message_sid', 'webhook_%')
      .order('created_at', { ascending: false });
    
    if (webhookError) {
      console.error('❌ Error obteniendo mensajes del webhook:', webhookError);
    } else {
      console.log(`✅ Mensajes del webhook: ${mensajesWebhook.length}`);
      
      if (mensajesWebhook.length > 0) {
        console.log('\n📝 MENSAJES DEL WEBHOOK:');
        mensajesWebhook.slice(0, 5).forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          const user_id = msg.user_id ? `user_id: ${msg.user_id}` : 'user_id: NULL';
          console.log(`  ${i + 1}. ${fecha} - ${user_id} - content: ${msg.content?.substring(0, 50)}...`);
        });
      }
    }
    
    // 4. Análisis
    console.log('\n🔍 4. ANÁLISIS');
    
    if (mensajeManual.length > 0 && mensajeManual[0].user_id) {
      console.log('✅ El mensaje manual se guardó correctamente con user_id');
      console.log('✅ La lógica de búsqueda de proveedores funciona');
      console.log('✅ El problema está en el webhook, no en la BD');
      
      console.log('\n💡 POSIBLES CAUSAS DEL PROBLEMA DEL WEBHOOK:');
      console.log('   1. El deployment no se completó correctamente');
      console.log('   2. Hay un error en el código del webhook');
      console.log('   3. Los logs de Vercel muestran errores');
      console.log('   4. El webhook no está procesando los mensajes correctamente');
      
    } else {
      console.log('❌ El mensaje manual no se guardó correctamente');
      console.log('💡 El problema puede estar en la BD o permisos');
    }
    
    // 5. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('1. Verificar los logs de Vercel para el webhook');
    console.log('2. Confirmar que el deployment se completó');
    console.log('3. Probar el webhook nuevamente');
    console.log('4. Si persiste, revisar el código del webhook línea por línea');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarMensajeManual();
