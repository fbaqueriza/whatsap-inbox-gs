require('dotenv').config({ path: '.env.local' });

async function verificarRealtimeFiltrado() {
  console.log('🔍 VERIFICANDO FILTRADO REALTIME POR USER_ID\n');

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
    
    // 2. Probar webhook para crear un mensaje nuevo
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    console.log(`\n🔗 Probando webhook para crear mensaje nuevo: ${webhookUrl}`);
    
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
              id: 'wamid.test_realtime_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'Mensaje de prueba - Realtime Filtrado - ' + new Date().toLocaleString()
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
    
    console.log('\n💡 LOGS ESPERADOS EN VERCEL:');
    console.log('🧪 [test_XXXXX] TEST ENDPOINT INICIADO:');
    console.log('🚀 [webhook_XXXXX] WEBHOOK INICIADO:');
    console.log('📥 [webhook_XXXXX] Webhook recibido: {...}');
    console.log('✅ [webhook_XXXXX] Es un mensaje de WhatsApp Business Account');
    console.log('📱 [webhook_XXXXX] Procesando 1 mensajes');
    console.log('✅ [webhook_XXXXX] Mensaje guardado con user_id: XXXXX');
    console.log('✅ [webhook_XXXXX] Procesados 1/1 mensajes (0 errores)');
    console.log('🏁 [webhook_XXXXX] WEBHOOK COMPLETADO en XXXms');
    
    console.log('\n🔧 LOGS ESPERADOS EN FRONTEND:');
    console.log('🔄 RealtimeService: Usuario no autenticado, no configurando suscripciones');
    console.log('🔗 RealtimeService: Configurando suscripciones para usuario XXXXX');
    console.log('🔌 RealtimeService: Desuscribiendo de mensajes para usuario XXXXX');
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Esperar 2-3 minutos para que se complete el deployment');
    console.log('2. Verificar logs de Vercel para ver los logs con requestId');
    console.log('3. Verificar logs del frontend para ver los logs de RealtimeService');
    console.log('4. Probar enviando un mensaje real desde WhatsApp');
    console.log('5. Verificar que el mensaje aparece en tiempo real en el frontend');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarRealtimeFiltrado();
