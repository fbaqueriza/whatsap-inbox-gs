require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function probarWebhookSimple() {
  console.log('🧪 PROBANDO WEBHOOK - VERSIÓN SIMPLIFICADA\n');

  try {
    // 1. Verificar configuración
    console.log('🔧 1. VERIFICANDO CONFIGURACIÓN');
    
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    console.log(`✅ Webhook URL: ${webhookUrl}`);
    console.log(`✅ Verify Token: ${verifyToken ? 'Configurado' : 'NO CONFIGURADO'}`);
    
    // 2. Verificar mensajes recientes
    console.log('\n📱 2. VERIFICANDO MENSAJES RECIENTES');
    
    const { data: mensajesRecientes, error: mensajesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('contact_id', '+5491135562673')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24 horas
      .order('created_at', { ascending: false });
    
    if (mensajesError) {
      console.error('❌ Error obteniendo mensajes:', mensajesError);
      return;
    }
    
    console.log(`✅ Mensajes del proveedor en las últimas 24 horas: ${mensajesRecientes.length}`);
    
    // 3. Verificar mensajes del webhook
    const mensajesWebhook = mensajesRecientes.filter(msg => msg.message_sid?.startsWith('webhook_'));
    console.log(`📥 Mensajes del webhook: ${mensajesWebhook.length}`);
    
    // 4. Verificar mensajes recibidos
    const mensajesRecibidos = mensajesRecientes.filter(msg => msg.message_type === 'received');
    console.log(`📥 Mensajes recibidos: ${mensajesRecibidos.length}`);
    
    // 5. Análisis
    console.log('\n🔍 3. ANÁLISIS DEL PROBLEMA');
    
    if (mensajesWebhook.length === 0) {
      console.log('❌ PROBLEMA: No hay mensajes del webhook');
      console.log('💡 Esto significa que:');
      console.log('   - El webhook no está recibiendo mensajes de Meta');
      console.log('   - Los mensajes no se están guardando correctamente');
      console.log('   - Hay un problema de conectividad');
    } else {
      console.log('✅ El webhook está funcionando');
    }
    
    if (mensajesRecibidos.length === 0) {
      console.log('❌ PROBLEMA: No hay mensajes recibidos');
      console.log('💡 Esto significa que:');
      console.log('   - El proveedor no está enviando mensajes');
      console.log('   - Los mensajes no se están guardando como "received"');
      console.log('   - Hay un problema en la lógica de guardado');
    } else {
      console.log('✅ Hay mensajes recibidos');
    }
    
    // 6. Mostrar ejemplos de mensajes
    if (mensajesRecientes.length > 0) {
      console.log('\n📝 4. EJEMPLOS DE MENSAJES RECIENTES:');
      mensajesRecientes.slice(0, 5).forEach((msg, i) => {
        const fecha = new Date(msg.created_at).toLocaleString('es-AR');
        const tipo = msg.message_type === 'sent' ? '📤 ENVIADO' : '📥 RECIBIDO';
        const origen = msg.message_sid?.startsWith('webhook_') ? '🌐 WEBHOOK' : '📱 OTRO';
        console.log(`  ${i + 1}. ${fecha} ${tipo} ${origen} - ${msg.content?.substring(0, 50)}...`);
      });
    }
    
    // 7. Recomendaciones
    console.log('\n💡 5. RECOMENDACIONES:');
    
    if (mensajesWebhook.length === 0) {
      console.log('🔧 Para solucionar el problema del webhook:');
      console.log('   1. Verificar que el webhook esté suscrito a eventos en Meta Developer Console');
      console.log('   2. Probar enviando un mensaje real desde el WhatsApp del proveedor');
      console.log('   3. Verificar los logs del servidor en Vercel');
      console.log('   4. Verificar que la URL del webhook sea accesible públicamente');
    }
    
    if (mensajesRecibidos.length === 0) {
      console.log('🔧 Para solucionar el problema de mensajes recibidos:');
      console.log('   1. Verificar que el proveedor esté enviando mensajes');
      console.log('   2. Verificar que los mensajes se guarden como "received"');
      console.log('   3. Verificar que el proveedor esté registrado correctamente');
    }
    
    console.log('\n🎯 PRÓXIMO PASO:');
    console.log('Enviar un mensaje real desde el WhatsApp del proveedor y verificar si llega al webhook');

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
}

probarWebhookSimple();
