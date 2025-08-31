require('dotenv').config({ path: '.env.local' });

async function testSolucionGarantizada() {
  console.log('🧪 PROBANDO SOLUCIÓN GARANTIZADA DEL WEBHOOK\n');

  try {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    console.log(`🔗 Webhook URL: ${webhookUrl}`);
    
    // Crear mensaje de prueba con estructura exacta de Meta
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
              profile: {
                name: 'Proveedor Test'
              },
              wa_id: '5491135562673'
            }],
            messages: [{
              from: '5491135562673',
              id: 'wamid.test_' + Date.now(),
              timestamp: Math.floor(Date.now() / 1000),
              text: {
                body: 'Mensaje de prueba - Solución Garantizada - ' + new Date().toLocaleString()
              },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };
    
    console.log('📤 Enviando mensaje de prueba...');
    console.log(`📝 Contenido: ${mensajePrueba.entry[0].changes[0].value.messages[0].text.body}`);
    
    // Enviar petición al webhook
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mensajePrueba)
    });
    
    console.log(`📡 Respuesta: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log(`📄 Datos de respuesta:`, responseData);
      
      if (responseData.requestId) {
        console.log(`✅ Request ID generado: ${responseData.requestId}`);
        console.log(`⏱️ Duración: ${responseData.duration}ms`);
        console.log(`✅ Procesado: ${responseData.processed}`);
      }
    } else {
      console.log('❌ Error en la respuesta del webhook');
    }
    
    console.log('\n💡 LOGS ESPERADOS EN VERCEL:');
    console.log('🚀 [webhook_XXXXX] WEBHOOK INICIADO:');
    console.log('📥 [webhook_XXXXX] Webhook recibido: { object: "whatsapp_business_account", ... }');
    console.log('✅ [webhook_XXXXX] Es un mensaje de WhatsApp Business Account');
    console.log('📱 [webhook_XXXXX] Procesando 1 mensajes');
    console.log('📱 [webhook_XXXXX] Procesando mensaje de WhatsApp: { from: "5491135562673", ... }');
    console.log('✅ [webhook_XXXXX] Encontrado usuario de la app XXXXX para proveedor +5491135562673');
    console.log('✅ [webhook_XXXXX] Mensaje guardado con user_id: XXXXX');
    console.log('📝 [webhook_XXXXX] Message SID: webhook_XXXXX');
    console.log('✅ [webhook_XXXXX] Mensaje procesado en XXXms');
    console.log('✅ [webhook_XXXXX] Procesados 1/1 mensajes (0 errores)');
    console.log('🏁 [webhook_XXXXX] WEBHOOK COMPLETADO en XXXms');
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Verificar logs de Vercel para ver los logs con requestId');
    console.log('2. Verificar que el mensaje se guarde en la base de datos');
    console.log('3. Probar con un mensaje real del proveedor');

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
}

testSolucionGarantizada();
