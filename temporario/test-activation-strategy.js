/**
 * Script de prueba para verificar la estrategia de activación manual
 * Prueba el manejo de números bloqueados por WhatsApp
 */

const testActivationStrategy = async () => {
  console.log('🧪 PROBANDO ESTRATEGIA DE ACTIVACIÓN MANUAL...\n');
  
  try {
    // Paso 1: Verificar diagnóstico
    console.log('1️⃣ Verificando diagnóstico de WhatsApp...');
    const diagnosticResponse = await fetch('http://localhost:3001/api/whatsapp/diagnostic');
    const diagnostic = await diagnosticResponse.json();
    
    console.log('✅ Templates disponibles:', diagnostic.templates.names);
    console.log('✅ Estado del servicio:', diagnostic.serviceStatus.enabled ? 'HABILITADO' : 'DESHABILITADO');
    
    // Paso 2: Probar envío a número bloqueado
    console.log('\n2️⃣ Probando envío a número bloqueado (+5491140494130)...');
    
    const sendResponse = await fetch('http://localhost:3001/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: '+5491140494130',
        message: 'inicializador_de_conv'
      }),
    });
    
    const sendResult = await sendResponse.json();
    
    console.log('📤 Resultado del envío:', {
      success: sendResult.success,
      error: sendResult.error,
      message_id: sendResult.message_id
    });
    
    if (!sendResult.success) {
      console.log('⚠️ Número bloqueado detectado');
      console.log('📋 Instrucciones de activación:');
      console.log('   1. El proveedor debe enviar un mensaje a: +5491141780300');
      console.log('   2. El mensaje debe contener: "Hola, soy Baron de la Menta"');
      console.log('   3. Una vez activado, podremos enviar notificaciones automáticas');
    }
    
    // Paso 3: Verificar logs del servidor
    console.log('\n3️⃣ Verificando logs del servidor...');
    console.log('🔍 Buscar en los logs:');
    console.log('   - "Número bloqueado por WhatsApp - requiere activación manual"');
    console.log('   - "Instrucciones de activación"');
    console.log('   - "Pedido guardado como requiere activación manual"');
    
    console.log('\n🎯 ESTRATEGIA IMPLEMENTADA:');
    console.log('   1. Detecta números bloqueados por WhatsApp');
    console.log('   2. Proporciona instrucciones claras de activación');
    console.log('   3. Guarda pedidos como "requiere activación manual"');
    console.log('   4. Permite seguimiento manual hasta activación');
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
};

// Ejecutar prueba
testActivationStrategy();
