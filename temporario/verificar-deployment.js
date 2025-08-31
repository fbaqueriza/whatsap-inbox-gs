require('dotenv').config({ path: '.env.local' });

async function verificarDeployment() {
  console.log('🚀 VERIFICANDO DEPLOYMENT DEL WEBHOOK\n');

  try {
    // 1. Verificar que el cambio se haya desplegado
    console.log('🔧 1. VERIFICANDO DEPLOYMENT');
    
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    console.log(`✅ Webhook URL: ${webhookUrl}`);
    
    // 2. Hacer una petición GET para verificar que el servidor responde
    console.log('\n🌐 2. VERIFICANDO RESPUESTA DEL SERVIDOR');
    
    try {
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      
      console.log('🔗 Probando petición GET al webhook...');
      
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log(`📡 Respuesta GET: ${response.status} ${response.statusText}`);
      
      if (response.status === 403) {
        console.log('✅ Servidor responde correctamente (403 es esperado para GET sin parámetros)');
      } else {
        console.log(`⚠️ Respuesta inesperada: ${response.status}`);
      }
      
    } catch (error) {
      console.log('❌ Error conectando al servidor:', error.message);
      console.log('💡 Esto puede indicar que:');
      console.log('   - El servidor no está corriendo');
      console.log('   - Hay un problema de conectividad');
      console.log('   - El deployment no se completó');
    }
    
    // 3. Verificar logs de Vercel
    console.log('\n📋 3. VERIFICANDO LOGS DE VERCEL');
    console.log('💡 Para ver los logs del servidor:');
    console.log('   1. Ir a https://vercel.com/dashboard');
    console.log('   2. Seleccionar el proyecto gastronomy-saas');
    console.log('   3. Ir a la pestaña "Functions"');
    console.log('   4. Buscar la función /api/whatsapp/webhook');
    console.log('   5. Revisar los logs de las últimas ejecuciones');
    
    // 4. Verificar si el código está actualizado
    console.log('\n📝 4. VERIFICANDO CÓDIGO ACTUALIZADO');
    console.log('💡 El cambio realizado fue:');
    console.log('   - Antes: .eq("phone", contactId.replace("+", ""))');
    console.log('   - Después: .or(`phone.eq.${contactId},phone.eq.${contactId.replace("+", "")}`)');
    console.log('   - Esto permite buscar el número tanto con + como sin +');
    
    // 5. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('1. Verificar que el deployment se completó en Vercel');
    console.log('2. Revisar los logs del servidor para ver errores');
    console.log('3. Probar el webhook nuevamente después de confirmar el deployment');
    console.log('4. Si el problema persiste, verificar la lógica de búsqueda en la BD');
    
    // 6. Próximos pasos
    console.log('\n🔄 PRÓXIMOS PASOS:');
    console.log('1. Ejecutar: node temporario/probar-webhook.js');
    console.log('2. Si sigue sin funcionar, revisar logs de Vercel');
    console.log('3. Verificar que la tabla providers tenga los datos correctos');
    console.log('4. Probar con un mensaje real del proveedor');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarDeployment();
