require('dotenv').config({ path: '.env.local' });

async function verificarLogsVercel() {
  console.log('🔍 VERIFICANDO LOGS DE VERCEL\n');

  try {
    console.log('📋 INSTRUCCIONES PARA VERIFICAR LOGS DE VERCEL:');
    console.log('');
    console.log('1. 🌐 IR A VERCEL DASHBOARD:');
    console.log('   https://vercel.com/dashboard');
    console.log('');
    console.log('2. 📁 SELECCIONAR PROYECTO:');
    console.log('   - Buscar "gastronomy-saas"');
    console.log('   - Hacer clic en el proyecto');
    console.log('');
    console.log('3. 🔧 IR A FUNCTIONS:');
    console.log('   - Pestaña "Functions"');
    console.log('   - Buscar "/api/whatsapp/webhook"');
    console.log('');
    console.log('4. 📊 REVISAR LOGS:');
    console.log('   - Hacer clic en la función');
    console.log('   - Pestaña "Logs"');
    console.log('   - Buscar logs recientes');
    console.log('');
    console.log('5. 🔍 BUSCAR ESTOS LOGS:');
    console.log('   - "📥 Webhook recibido:"');
    console.log('   - "✅ Es un mensaje de WhatsApp Business Account"');
    console.log('   - "📱 Procesando X mensajes"');
    console.log('   - "❌ Error procesando webhook:"');
    console.log('');
    console.log('6. 📝 VERIFICAR DEPLOYMENT:');
    console.log('   - Pestaña "Deployments"');
    console.log('   - Verificar que el último deployment esté "Ready"');
    console.log('   - Verificar la fecha del deployment');
    console.log('');
    console.log('💡 POSIBLES PROBLEMAS:');
    console.log('');
    console.log('❌ PROBLEMA 1: Deployment no completado');
    console.log('   - El código no se actualizó en Vercel');
    console.log('   - Solución: Hacer un nuevo commit y push');
    console.log('');
    console.log('❌ PROBLEMA 2: Error en el código');
    console.log('   - Los logs muestran errores de JavaScript');
    console.log('   - Solución: Revisar y corregir el código');
    console.log('');
    console.log('❌ PROBLEMA 3: Variables de entorno');
    console.log('   - Las variables de entorno no están configuradas');
    console.log('   - Solución: Verificar en Settings > Environment Variables');
    console.log('');
    console.log('❌ PROBLEMA 4: Webhook no procesa mensajes');
    console.log('   - Los logs muestran que llega el webhook pero no procesa');
    console.log('   - Solución: Revisar la lógica de procesamiento');
    console.log('');
    console.log('🔄 PRÓXIMOS PASOS:');
    console.log('');
    console.log('1. Revisar los logs de Vercel siguiendo las instrucciones');
    console.log('2. Si hay errores, corregirlos');
    console.log('3. Si no hay logs, verificar que el deployment se completó');
    console.log('4. Probar el webhook nuevamente');
    console.log('5. Si persiste, probar con un mensaje real del proveedor');
    console.log('');
    console.log('📞 MENSAJE REAL DEL PROVEEDOR:');
    console.log('   - Enviar un mensaje desde el WhatsApp del proveedor +5491135562673');
    console.log('   - Verificar si aparece en los logs de Vercel');
    console.log('   - Verificar si se guarda en la base de datos');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verificarLogsVercel();
