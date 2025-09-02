/**
 * Script de prueba para verificar la estrategia de fallback para errores de engagement
 * Prueba el envío de template y fallback a mensaje de texto
 */

const testEngagementFallback = async () => {
  console.log('🧪 PROBANDO ESTRATEGIA DE FALLBACK PARA ENGAGEMENT...\n');
  
  try {
    // Paso 1: Verificar diagnóstico
    console.log('1️⃣ Verificando diagnóstico de WhatsApp...');
    const diagnosticResponse = await fetch('http://localhost:3001/api/whatsapp/diagnostic');
    const diagnostic = await diagnosticResponse.json();
    
    console.log('✅ Templates disponibles:', diagnostic.templates.names);
    console.log('✅ Estado del servicio:', diagnostic.serviceStatus.enabled ? 'HABILITADO' : 'DESHABILITADO');
    
    // Paso 2: Probar envío de orden con estrategia de fallback
    console.log('\n2️⃣ Probando envío de orden con estrategia de fallback...');
    
    // Simular envío de orden usando el endpoint de notificación
    const orderData = {
      orderId: 'test-order-engagement-123',
      providerId: '16f5f063-6fe6-44c6-9f59-f796f34dbea2' // Baron de la Menta
    };
    
    const notificationResponse = await fetch('http://localhost:3001/api/orders/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    
    const notificationResult = await notificationResponse.json();
    
    console.log('📤 Resultado de notificación:', {
      success: notificationResult.success,
      templateSent: notificationResult.templateSent,
      pendingOrderSaved: notificationResult.pendingOrderSaved,
      errors: notificationResult.errors?.length || 0
    });
    
    if (notificationResult.success) {
      console.log('✅ Notificación enviada exitosamente');
      
      if (notificationResult.templateSent) {
        console.log('📱 Template enviado correctamente');
      } else {
        console.log('💬 Fallback a mensaje de texto ejecutado');
      }
    } else {
      console.log('❌ Error en notificación:', notificationResult.errors);
    }
    
    // Paso 3: Verificar logs del servidor
    console.log('\n3️⃣ Verificando logs del servidor...');
    console.log('🔍 Buscar en los logs:');
    console.log('   - "Intentando enviar template inicializador_de_conv"');
    console.log('   - "Error de engagement detectado"');
    console.log('   - "Mensaje de texto enviado exitosamente como fallback"');
    
    console.log('\n🎯 ESTRATEGIA IMPLEMENTADA:');
    console.log('   1. Intenta enviar template inicializador_de_conv');
    console.log('   2. Si falla por engagement (131049/131047), envía mensaje de texto');
    console.log('   3. El mensaje de texto inicia la conversación');
    console.log('   4. Templates futuros deberían funcionar');
    
  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
};

// Ejecutar prueba
testEngagementFallback();
