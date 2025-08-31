require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function asignarUserIdMensajesRecientes() {
  console.log('🔧 ASIGNANDO USER_ID A MENSAJES RECIENTES\n');

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
    
    // 2. Obtener mensajes sin user_id del número problemático
    console.log('\n📱 2. OBTENIENDO MENSAJES SIN USER_ID DEL NÚMERO PROBLEMÁTICO');
    const { data: mensajesSinUserId, error: mensajesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .is('user_id', null)
      .eq('contact_id', '+670680919470999')
      .order('created_at', { ascending: false });
    
    if (mensajesError) {
      console.error('❌ Error obteniendo mensajes:', mensajesError);
      return;
    }
    
    console.log(`✅ Encontrados ${mensajesSinUserId.length} mensajes sin user_id del número +670680919470999`);
    
    if (mensajesSinUserId.length === 0) {
      console.log('✅ No hay mensajes para asignar');
      return;
    }
    
    // 3. Asignar user_id a todos los mensajes
    console.log('\n🔧 3. ASIGNANDO USER_ID A LOS MENSAJES');
    let assignedCount = 0;
    let errorCount = 0;
    
    for (const message of mensajesSinUserId) {
      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({ user_id: testUserId })
        .eq('id', message.id);
      
      if (updateError) {
        console.error(`❌ Error actualizando mensaje ${message.id}:`, updateError);
        errorCount++;
      } else {
        assignedCount++;
        console.log(`✅ Asignado user_id ${testUserId} a mensaje ${message.id} (${message.content?.substring(0, 30)}...)`);
      }
    }
    
    console.log(`\n📊 RESULTADO DE LA ASIGNACIÓN:`);
    console.log(`✅ Mensajes asignados: ${assignedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📱 Total procesados: ${mensajesSinUserId.length}`);
    
    // 4. Verificar que la asignación funcionó
    console.log('\n🔍 4. VERIFICANDO QUE LA ASIGNACIÓN FUNCIONÓ');
    const { data: mensajesVerificacion, error: verificacionError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+670680919470999')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (verificacionError) {
      console.error('❌ Error en verificación:', verificacionError);
    } else {
      const mensajesConUserId = mensajesVerificacion.filter(m => m.user_id !== null);
      const mensajesSinUserId = mensajesVerificacion.filter(m => m.user_id === null);
      
      console.log(`✅ Mensajes con user_id: ${mensajesConUserId.length}`);
      console.log(`❓ Mensajes sin user_id: ${mensajesSinUserId.length}`);
      
      if (mensajesConUserId.length > 0) {
        console.log('\n📝 Ejemplos de mensajes asignados:');
        mensajesConUserId.slice(0, 3).forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          console.log(`  ${i + 1}. ${fecha} - user_id: ${msg.user_id}, content: ${msg.content?.substring(0, 30)}...`);
        });
      }
    }
    
    // 5. Verificar mensajes del usuario después de la asignación
    console.log('\n👤 5. VERIFICANDO MENSAJES DEL USUARIO DESPUÉS DE LA ASIGNACIÓN');
    const { data: userMessagesAfter, error: userMessagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (userMessagesError) {
      console.error('❌ Error obteniendo mensajes del usuario:', userMessagesError);
    } else {
      const userReceivedMessages = userMessagesAfter.filter(m => m.message_type === 'received');
      const userSentMessages = userMessagesAfter.filter(m => m.message_type === 'sent');
      
      console.log(`✅ Total mensajes del usuario: ${userMessagesAfter.length}`);
      console.log(`📥 Mensajes recibidos: ${userReceivedMessages.length}`);
      console.log(`📤 Mensajes enviados: ${userSentMessages.length}`);
      
      if (userReceivedMessages.length > 0) {
        console.log('\n📝 Ejemplos de mensajes recibidos del usuario:');
        userReceivedMessages.slice(0, 3).forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          console.log(`  ${i + 1}. ${fecha} - contact_id: ${msg.contact_id}, content: ${msg.content?.substring(0, 30)}...`);
        });
      }
    }
    
    // 6. Resumen final
    console.log('\n📋 RESUMEN FINAL:');
    if (assignedCount > 0) {
      console.log('✅ ASIGNACIÓN EXITOSA');
      console.log(`📱 ${assignedCount} mensajes del número +670680919470999 ahora tienen user_id`);
      console.log('🎯 Los mensajes deberían aparecer en el chat del usuario');
      console.log('💡 El proveedor está usando un número diferente al registrado');
    } else {
      console.log('⚠️ No se asignaron mensajes');
    }
    
    console.log('\n🔧 RECOMENDACIONES:');
    console.log('1. 📱 Actualizar el número del proveedor en la base de datos');
    console.log('2. 🔄 Verificar que el webhook maneje números no registrados');
    console.log('3. 📋 Documentar el número real del proveedor');

  } catch (error) {
    console.error('❌ Error en asignación:', error);
  }
}

asignarUserIdMensajesRecientes();
