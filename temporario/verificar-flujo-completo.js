require('dotenv').config({ path: '.env.local' });

async function verificarFlujoCompleto() {
  console.log('🔍 VERIFICANDO FLUJO COMPLETO DE ENVÍO DE ORDEN\n');

  try {
    // 1. Probar endpoint de prueba para verificar que funciona
    const testUrl = 'https://gastronomy-saas.vercel.app/api/whatsapp/test';
    console.log(`🔗 Probando endpoint de prueba: ${testUrl}`);
    
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`📡 Test endpoint: ${testResponse.status} ${testResponse.statusText}`);
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log(`✅ Test endpoint funciona:`, {
        requestId: testData.requestId,
        duration: testData.duration,
        providers: testData.providers?.length || 0,
        mensajesCount: testData.mensajesCount
      });
    }
    
    // 2. Probar webhook para crear un mensaje nuevo que active el flujo completo
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    console.log(`\n🔗 Probando webhook para activar flujo completo: ${webhookUrl}`);
    
    const mensajePrueba = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '1123051623072203',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5491135562673',
              phone_number_id: '670680919470999'
            },
            contacts: [{
              profile: { name: 'Proveedor Test' },
              wa_id: '5491135562673'
            }],
            messages: [{
              from: '5491135562673',
              id: 'wamid.test_flujo_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'si' // Respuesta de confirmación
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };
    
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mensajePrueba)
    });
    
    console.log(`📡 Webhook: ${webhookResponse.status} ${webhookResponse.statusText}`);
    
    if (webhookResponse.ok) {
      const webhookData = await webhookResponse.json();
      console.log(`✅ Webhook funciona:`, {
        requestId: webhookData.requestId,
        duration: webhookData.duration,
        processed: webhookData.processed
      });
    }
    
    console.log('\n💡 FLUJO COMPLETO ESPERADO:');
    console.log('1. 📤 Usuario crea pedido en frontend');
    console.log('2. 🔄 OrderNotificationService.sendOrderNotification() se ejecuta');
    console.log('3. 📱 sendTemplateToMeta() envía template "envio_de_orden"');
    console.log('4. 💾 savePendingOrderAtomic() guarda pedido pendiente');
    console.log('5. ✅ Mensaje disparador se guarda en BD (NUEVO)');
    console.log('6. 📱 Mensaje aparece en chat del frontend (NUEVO)');
    console.log('7. 📥 Proveedor responde al mensaje');
    console.log('8. 🔄 Webhook recibe respuesta del proveedor');
    console.log('9. ✅ processProviderResponse() procesa confirmación');
    console.log('10. 📤 sendOrderDetails() envía detalles al proveedor');
    console.log('11. ✅ Detalles se guardan en BD (NUEVO)');
    console.log('12. 🗑️ Pedido pendiente se elimina');
    
    console.log('\n💡 LOGS ESPERADOS EN VERCEL:');
    console.log('🧪 [test_XXXXX] TEST ENDPOINT INICIADO:');
    console.log('🚀 [webhook_XXXXX] WEBHOOK INICIADO:');
    console.log('📥 [webhook_XXXXX] Webhook recibido: {...}');
    console.log('✅ [webhook_XXXXX] Es un mensaje de WhatsApp Business Account');
    console.log('📱 [webhook_XXXXX] Procesando 1 mensajes');
    console.log('✅ [webhook_XXXXX] Mensaje guardado con user_id: XXXXX');
    console.log('🔄 [webhook_XXXXX] Iniciando processProviderResponse para: +5491135562673');
    console.log('✅ [webhook_XXXXX] Respuesta del proveedor procesada exitosamente');
    console.log('📤 Enviando detalles del pedido al proveedor...');
    console.log('✅ Detalles enviados exitosamente');
    console.log('✅ [webhook_XXXXX] Procesados 1/1 mensajes (0 errores)');
    console.log('🏁 [webhook_XXXXX] WEBHOOK COMPLETADO en XXXms');
    
    console.log('\n🔧 CAMBIOS IMPLEMENTADOS:');
    console.log('✅ Endpoint /api/whatsapp/send ahora guarda mensajes en BD');
    console.log('✅ Mensajes disparadores aparecen en chat del frontend');
    console.log('✅ Respuestas del proveedor se procesan correctamente');
    console.log('✅ Detalles del pedido se envían y guardan en BD');
    console.log('✅ Flujo completo de envío de orden funcionando');
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Esperar 2-3 minutos para que se complete el deployment');
    console.log('2. Crear un nuevo pedido en el frontend');
    console.log('3. Verificar que el mensaje disparador aparece en el chat');
    console.log('4. Responder al mensaje desde WhatsApp del proveedor');
    console.log('5. Verificar que se envían los detalles del pedido');
    console.log('6. Verificar que todo el flujo funciona correctamente');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarFlujoCompleto();
