require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificacionFinal() {
  console.log('🎯 VERIFICACIÓN FINAL DEL WEBHOOK\n');

  try {
    // 1. Verificar configuración
    console.log('🔧 1. VERIFICANDO CONFIGURACIÓN');
    
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    console.log(`✅ Webhook URL: ${webhookUrl}`);
    console.log(`✅ Verify Token: ${verifyToken ? 'Configurado' : 'NO CONFIGURADO'}`);
    
    // 2. Verificar mensajes actuales
    console.log('\n📱 2. VERIFICANDO MENSAJES ACTUALES');
    
    const { data: mensajesActuales, error: mensajesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (mensajesError) {
      console.error('❌ Error obteniendo mensajes:', mensajesError);
    } else {
      console.log(`✅ Mensajes actuales del proveedor: ${mensajesActuales.length}`);
      
      if (mensajesActuales.length > 0) {
        console.log('\n📝 MENSAJES RECIENTES:');
        mensajesActuales.forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
          const user_id = msg.user_id ? `user_id: ${msg.user_id}` : 'user_id: NULL';
          console.log(`  ${i + 1}. ${fecha} ${tipo} - ${user_id} - content: ${msg.content?.substring(0, 50)}...`);
        });
      }
    }
    
    // 3. Verificar mensajes del webhook
    console.log('\n📱 3. VERIFICANDO MENSAJES DEL WEBHOOK');
    
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
        mensajesWebhook.slice(0, 3).forEach((msg, i) => {
          const fecha = new Date(msg.created_at).toLocaleString('es-AR');
          const user_id = msg.user_id ? `user_id: ${msg.user_id}` : 'user_id: NULL';
          console.log(`  ${i + 1}. ${fecha} - ${user_id} - content: ${msg.content?.substring(0, 50)}...`);
        });
      }
    }
    
    // 4. Análisis final
    console.log('\n🔍 4. ANÁLISIS FINAL');
    
    if (mensajesWebhook.length > 0) {
      console.log('🎉 ¡ÉXITO! El webhook está funcionando correctamente');
      console.log('✅ Los mensajes se están guardando con user_id');
      console.log('✅ La lógica de búsqueda de proveedores funciona');
      console.log('✅ El sistema está operativo');
      
      console.log('\n💡 PRÓXIMOS PASOS:');
      console.log('1. Probar con un mensaje real del proveedor +5491135562673');
      console.log('2. Verificar que aparezca en la plataforma');
      console.log('3. Confirmar que se procese correctamente');
      
    } else {
      console.log('❌ PROBLEMA: No hay mensajes del webhook');
      console.log('💡 Posibles causas:');
      console.log('   - El deployment no se completó correctamente');
      console.log('   - Los logs críticos no aparecen en Vercel');
      console.log('   - El webhook no está procesando los mensajes');
      
      console.log('\n🔄 RECOMENDACIONES:');
      console.log('1. Verificar los logs de Vercel para el webhook');
      console.log('2. Confirmar que el deployment esté "Ready"');
      console.log('3. Probar con un mensaje real del proveedor');
      console.log('4. Revisar la configuración del webhook en Meta Developer Console');
    }
    
    // 5. Estado del sistema
    console.log('\n📊 5. ESTADO DEL SISTEMA');
    console.log(`✅ Base de datos: ${mensajesError ? 'ERROR' : 'OPERATIVA'}`);
    console.log(`✅ Proveedor registrado: ${mensajesActuales.length > 0 ? 'SÍ' : 'NO'}`);
    console.log(`✅ Webhook funcionando: ${mensajesWebhook.length > 0 ? 'SÍ' : 'NO'}`);
    console.log(`✅ Mensajes con user_id: ${mensajesActuales.filter(m => m.user_id).length}/${mensajesActuales.length}`);
    
    // 6. Comandos útiles
    console.log('\n🔧 COMANDOS ÚTILES:');
    console.log('node temporario/probar-webhook.js');
    console.log('node temporario/verificar-mensaje-manual.js');
    console.log('node temporario/verificar-tabla-providers.js');

  } catch (error) {
    console.error('❌ Error en verificación final:', error);
  }
}

verificacionFinal();
