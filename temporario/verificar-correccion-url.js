const fetch = require('node-fetch');

async function verificarCorreccionUrl() {
  console.log('🔍 Verificando corrección de URL en OrderNotificationService...\n');

  try {
    // Simular las variables de entorno que causaban el problema
    const testCases = [
      {
        name: 'Caso problemático original',
        env: {
          NEXT_PUBLIC_VERCEL_URL: 'gastronomy-saas-msjlrjqin-franciscos-projects-d4a4de5c.vercel.app'
        }
      },
      {
        name: 'Caso con protocolo',
        env: {
          NEXT_PUBLIC_VERCEL_URL: 'https://gastronomy-saas-msjlrjqin-franciscos-projects-d4a4de5c.vercel.app'
        }
      },
      {
        name: 'Caso VERCEL_URL',
        env: {
          VERCEL_URL: 'gastronomy-saas.vercel.app'
        }
      },
      {
        name: 'Caso NEXT_PUBLIC_APP_URL',
        env: {
          NEXT_PUBLIC_APP_URL: 'https://gastronomy-saas.vercel.app'
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`📋 ${testCase.name}:`);
      
      // Simular la lógica de buildBaseUrl
      let baseUrl;
      
      if (testCase.env.VERCEL_URL) {
        baseUrl = `https://${testCase.env.VERCEL_URL}`;
      } else if (testCase.env.NEXT_PUBLIC_APP_URL) {
        baseUrl = testCase.env.NEXT_PUBLIC_APP_URL;
      } else if (testCase.env.NEXT_PUBLIC_VERCEL_URL) {
        const vercelUrl = testCase.env.NEXT_PUBLIC_VERCEL_URL;
        if (vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')) {
          baseUrl = vercelUrl;
        } else {
          baseUrl = `https://${vercelUrl}`;
        }
      } else {
        baseUrl = 'https://gastronomy-saas.vercel.app';
      }
      
      console.log(`   URL construida: ${baseUrl}`);
      
      // Verificar que la URL es válida
      try {
        new URL(`${baseUrl}/api/whatsapp/send`);
        console.log('   ✅ URL válida');
      } catch (error) {
        console.log(`   ❌ URL inválida: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('🎯 Resultado esperado:');
    console.log('   - Todas las URLs deben ser válidas');
    console.log('   - El protocolo https:// debe estar presente');
    console.log('   - No debe haber errores de "Invalid URL"');
    
    console.log('\n📤 Para probar la corrección:');
    console.log('   1. Crear un nuevo pedido');
    console.log('   2. Responder al mensaje disparador desde WhatsApp');
    console.log('   3. Verificar que se envían los detalles del pedido');
    console.log('   4. Revisar logs de Vercel para confirmar que no hay errores de URL');

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarCorreccionUrl();
