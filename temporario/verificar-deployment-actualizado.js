require('dotenv').config({ path: '.env.local' });

async function verificarDeploymentActualizado() {
  console.log('🔍 VERIFICANDO SI EL DEPLOYMENT SE ACTUALIZÓ\n');

  try {
    // 1. Probar endpoint de prueba
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
    } else {
      console.log(`❌ Test endpoint no funciona: ${await testResponse.text()}`);
    }
    
    // 2. Probar webhook principal
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    console.log(`\n🔗 Probando webhook principal: ${webhookUrl}`);
    
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
              id: 'wamid.test_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'Mensaje de prueba - Verificación Deployment - ' + new Date().toLocaleString()
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
    
    console.log(`📡 Webhook principal: ${webhookResponse.status} ${webhookResponse.statusText}`);
    
    if (webhookResponse.ok) {
      const webhookData = await webhookResponse.json();
      console.log(`✅ Webhook principal funciona:`, {
        requestId: webhookData.requestId,
        duration: webhookData.duration,
        processed: webhookData.processed
      });
    } else {
      console.log(`❌ Webhook principal no funciona: ${await webhookResponse.text()}`);
    }
    
    console.log('\n💡 LOGS ESPERADOS EN VERCEL:');
    console.log('🧪 [test_XXXXX] TEST ENDPOINT INICIADO:');
    console.log('🚀 [webhook_XXXXX] WEBHOOK INICIADO:');
    console.log('📥 [webhook_XXXXX] Webhook recibido: {...}');
    console.log('✅ [webhook_XXXXX] Es un mensaje de WhatsApp Business Account');
    console.log('📱 [webhook_XXXXX] Procesando 1 mensajes');
    console.log('✅ [webhook_XXXXX] Mensaje guardado con user_id: XXXXX');
    console.log('✅ [webhook_XXXXX] Procesados 1/1 mensajes (0 errores)');
    console.log('🏁 [webhook_XXXXX] WEBHOOK COMPLETADO en XXXms');
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Esperar 2-3 minutos para que se complete el deployment');
    console.log('2. Verificar logs de Vercel para ver los logs con requestId');
    console.log('3. Si aparecen los logs con requestId, el deployment se actualizó');
    console.log('4. Si no aparecen, hay un problema con Vercel');
    console.log('5. Probar con un mensaje real del proveedor +5491135562673');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarDeploymentActualizado();
