require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarWebhook() {
  console.log('🔍 VERIFICANDO FUNCIONAMIENTO DEL WEBHOOK\n');

  try {
    // 1. Verificar configuración del webhook
    console.log('🔧 1. VERIFICANDO CONFIGURACIÓN DEL WEBHOOK');
    
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    
    console.log(`✅ VERIFY_TOKEN configurado: ${verifyToken ? 'SÍ' : 'NO'}`);
    console.log(`✅ WEBHOOK_URL configurada: ${webhookUrl ? 'SÍ' : 'NO'}`);
    
    if (!verifyToken) {
      console.log('❌ PROBLEMA: WHATSAPP_VERIFY_TOKEN no está configurado');
      console.log('💡 Solución: Configurar WHATSAPP_VERIFY_TOKEN en .env.local');
    }
    
    if (!webhookUrl) {
      console.log('❌ PROBLEMA: WHATSAPP_WEBHOOK_URL no está configurada');
      console.log('💡 Solución: Configurar WHATSAPP_WEBHOOK_URL en .env.local');
    }
    
    // 2. Verificar mensajes recientes del proveedor
    console.log('\n📱 2. VERIFICANDO MENSAJES RECIENTES DEL PROVEEDOR +5491135562673');
    
    const { data: mensajesRecientes, error: mensajesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24 horas
      .order('created_at', { ascending: false });
    
    if (mensajesError) {
      console.error('❌ Error obteniendo mensajes recientes:', mensajesError);
      return;
    }
    
    console.log(`✅ Mensajes del proveedor en las últimas 24 horas: ${mensajesRecientes.length}`);
    
    if (mensajesRecientes.length > 0) {
      console.log('\n📝 MENSAJES RECIENTES:');
      mensajesRecientes.slice(0, 10).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
        const user_id = msg.user_id ? `user_id: ${msg.user_id}` : 'user_id: NULL';
        console.log(`  ${i + 1}. ${fecha} ${tipo} - ${user_id} - content: ${msg.content?.substring(0, 50)}...`);
      });
    } else {
      console.log('⚠️ No hay mensajes recientes del proveedor');
    }
    
    // 3. Verificar mensajes por source (webhook vs otros)
    console.log('\n🔍 3. VERIFICANDO ORIGEN DE LOS MENSAJES');
    
    const mensajesWebhook = mensajesRecientes.filter(msg => msg.message_sid?.startsWith('webhook_'));
    const mensajesOtros = mensajesRecientes.filter(msg => !msg.message_sid?.startsWith('webhook_'));
    
    console.log(`📥 Mensajes del webhook: ${mensajesWebhook.length}`);
    console.log(`📤 Mensajes de otras fuentes: ${mensajesOtros.length}`);
    
    // 4. Verificar si el webhook está activo
    console.log('\n🌐 4. VERIFICANDO ESTADO DEL WEBHOOK');
    
    // Intentar hacer una petición al webhook para verificar que responde
    try {
      const webhookTestUrl = webhookUrl || 'http://localhost:3001/api/whatsapp/webhook';
      console.log(`🔗 Probando webhook en: ${webhookTestUrl}`);
      
      // Nota: En un entorno real, esto requeriría hacer una petición HTTP
      console.log('💡 Para verificar el webhook completamente, necesitas:');
      console.log('   1. Que el servidor esté corriendo');
      console.log('   2. Que ngrok esté configurado correctamente');
      console.log('   3. Que el webhook esté registrado en Meta Developer Console');
      
    } catch (error) {
      console.log('❌ No se pudo verificar el webhook:', error.message);
    }
    
    // 5. Verificar configuración de Meta Developer Console
    console.log('\n⚙️ 5. VERIFICANDO CONFIGURACIÓN DE META DEVELOPER CONSOLE');
    
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_API_KEY;
    
    console.log(`✅ PHONE_NUMBER_ID configurado: ${phoneNumberId ? 'SÍ' : 'NO'}`);
    console.log(`✅ ACCESS_TOKEN configurado: ${accessToken ? 'SÍ' : 'NO'}`);
    
    if (!phoneNumberId) {
      console.log('❌ PROBLEMA: NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID no está configurado');
    }
    
    if (!accessToken) {
      console.log('❌ PROBLEMA: WHATSAPP_ACCESS_TOKEN no está configurado');
    }
    
    // 6. Análisis del problema
    console.log('\n🔍 6. ANÁLISIS DEL PROBLEMA');
    
    if (mensajesRecientes.length === 0) {
      console.log('❌ PROBLEMA: No hay mensajes recientes del proveedor');
      console.log('💡 Posibles causas:');
      console.log('   - El webhook no está recibiendo mensajes');
      console.log('   - El webhook no está configurado correctamente');
      console.log('   - El proveedor no está enviando mensajes');
      console.log('   - Los mensajes no se están guardando en la BD');
    } else if (mensajesWebhook.length === 0) {
      console.log('❌ PROBLEMA: No hay mensajes del webhook');
      console.log('💡 Posibles causas:');
      console.log('   - El webhook no está funcionando');
      console.log('   - Los mensajes se están guardando por otra vía');
    } else {
      console.log('✅ El webhook está funcionando correctamente');
    }
    
    // 7. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('1. Verificar que el servidor esté corriendo en puerto 3001');
    console.log('2. Verificar que ngrok esté configurado y funcionando');
    console.log('3. Verificar que el webhook esté registrado en Meta Developer Console');
    console.log('4. Verificar que el VERIFY_TOKEN coincida en ambos lugares');
    console.log('5. Probar enviando un mensaje desde el WhatsApp del proveedor');
    console.log('6. Revisar los logs del servidor para ver si llegan webhooks');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarWebhook();
