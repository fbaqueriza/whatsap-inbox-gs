require('dotenv').config({ path: '.env.local' });

async function probarEndpointTest() {
  console.log('🧪 PROBANDO ENDPOINT DE TEST\n');

  try {
    const testUrl = 'https://gastronomy-saas.vercel.app/api/whatsapp/test';
    console.log(`🔗 Test URL: ${testUrl}`);
    
    // Enviar petición GET al endpoint de prueba
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    console.log('📤 Enviando petición GET al endpoint de prueba...');
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`📡 Respuesta: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log(`📄 Datos de respuesta:`, JSON.stringify(responseData, null, 2));
      
      if (responseData.requestId) {
        console.log(`✅ Request ID generado: ${responseData.requestId}`);
        console.log(`⏱️ Duración: ${responseData.duration}ms`);
        console.log(`📱 Mensajes del proveedor: ${responseData.mensajesCount}`);
        console.log(`✅ Mensaje de prueba guardado: ${responseData.testMessageSaved}`);
        
        if (responseData.providers && responseData.providers.length > 0) {
          console.log(`👥 Proveedores encontrados: ${responseData.providers.length}`);
          responseData.providers.forEach((provider, i) => {
            console.log(`  ${i + 1}. phone: ${provider.phone}, name: ${provider.name}, user_id: ${provider.user_id}`);
          });
        }
      }
    } else {
      console.log('❌ Error en la respuesta del endpoint de prueba');
      const errorText = await response.text();
      console.log(`📄 Error: ${errorText}`);
    }
    
    console.log('\n💡 LOGS ESPERADOS EN VERCEL:');
    console.log('🧪 [test_XXXXX] TEST ENDPOINT INICIADO:');
    console.log('🔧 [test_XXXXX] Variables de entorno: { supabaseUrl: "Configurado", supabaseKey: "Configurado" }');
    console.log('🔗 [test_XXXXX] Probando conexión a Supabase...');
    console.log('✅ [test_XXXXX] Proveedores encontrados: [...]');
    console.log('💾 [test_XXXXX] Guardando mensaje de prueba: {...}');
    console.log('✅ [test_XXXXX] Mensaje de prueba guardado correctamente');
    console.log('📱 [test_XXXXX] Mensajes del proveedor: X');
    console.log('🏁 [test_XXXXX] TEST ENDPOINT COMPLETADO en XXXms');
    
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('1. Verificar logs de Vercel para ver los logs con test_XXXXX');
    console.log('2. Si el endpoint de prueba funciona, el webhook debería funcionar');
    console.log('3. Si no funciona, hay un problema con el deployment');
    console.log('4. Probar el webhook principal después de confirmar el test');

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
}

probarEndpointTest();
