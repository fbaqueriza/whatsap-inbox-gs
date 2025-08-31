require('dotenv').config({ path: '.env.local' });

console.log('🔍 DIAGNÓSTICO DE VARIABLES DE ENTORNO Y URL CONSTRUCTION');
console.log('========================================================');

// Simular el entorno de Vercel
console.log('\n📋 Variables de entorno disponibles:');
console.log('VERCEL_URL:', process.env.VERCEL_URL || 'NO DEFINIDA');
console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'NO DEFINIDA');
console.log('NEXT_PUBLIC_VERCEL_URL:', process.env.NEXT_PUBLIC_VERCEL_URL || 'NO DEFINIDA');

// Función buildBaseUrl simulada
function buildBaseUrl() {
  let baseUrl = '';
  
  // Cliente (navegador)
  if (typeof window !== 'undefined') {
    baseUrl = window.location.origin;
    console.log(`[buildBaseUrl] Client-side URL: ${baseUrl}`);
    return baseUrl;
  }
  
  // Servidor - Vercel (URL única del deployment)
  if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
    console.log(`[buildBaseUrl] VERCEL_URL: ${baseUrl}`);
    return baseUrl;
  }
  
  // Servidor - Variables de entorno públicas (para alias o custom domains)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    console.log(`[buildBaseUrl] NEXT_PUBLIC_APP_URL: ${baseUrl}`);
    return baseUrl;
  }
  
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
    // Asegurar que tenga protocolo https://
    if (vercelUrl.startsWith('http://') || vercelUrl.startsWith('https://')) {
      baseUrl = vercelUrl;
    } else {
      baseUrl = `https://${vercelUrl}`;
    }
    console.log(`[buildBaseUrl] NEXT_PUBLIC_VERCEL_URL: ${baseUrl}`);
    return baseUrl;
  }
  
  // Fallback de producción
  baseUrl = 'https://gastronomy-saas.vercel.app';
  console.warn(`[buildBaseUrl] Fallback URL: ${baseUrl}`);
  return baseUrl;
}

console.log('\n🔧 Probando buildBaseUrl():');
const testUrl = buildBaseUrl();
console.log('URL resultante:', testUrl);

// Verificar que la URL sea válida
try {
  const url = new URL(testUrl);
  console.log('✅ URL válida:', url.toString());
  console.log('Protocolo:', url.protocol);
  console.log('Hostname:', url.hostname);
  console.log('Puerto:', url.port || 'default');
} catch (error) {
  console.error('❌ URL inválida:', error.message);
}

// Probar endpoint específico
const endpointUrl = `${testUrl}/api/whatsapp/send`;
console.log('\n📡 URL del endpoint:', endpointUrl);

// Verificar que el endpoint sea accesible (simulación)
console.log('\n💡 RECOMENDACIONES:');
console.log('1. Verifica que VERCEL_URL esté configurada en las variables de entorno de Vercel');
console.log('2. Si usas un dominio personalizado, configura NEXT_PUBLIC_APP_URL');
console.log('3. Asegúrate de que la URL no contenga caracteres especiales o espacios');
console.log('4. El endpoint debe responder con JSON, no HTML');

console.log('\n🔍 Para verificar en Vercel:');
console.log('- Ve a tu proyecto en Vercel Dashboard');
console.log('- Settings > Environment Variables');
console.log('- Verifica que VERCEL_URL esté presente y sea correcta');
console.log('- Si usas alias, configura NEXT_PUBLIC_APP_URL con tu dominio');
