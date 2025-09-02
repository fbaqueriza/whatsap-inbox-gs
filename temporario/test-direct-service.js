// Script para probar directamente el servicio de Meta WhatsApp
const testDirectService = async () => {
  try {
    console.log('🔍 Probando servicio de Meta WhatsApp directamente...');
    
    const baseUrl = 'http://localhost:3001';
    
    // Probar endpoint de diagnóstico primero
    console.log('📤 Probando endpoint de diagnóstico...');
    
    const diagnosticResponse = await fetch(`${baseUrl}/api/whatsapp/diagnostic`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📥 Diagnostic response status:', diagnosticResponse.status);
    
    if (diagnosticResponse.ok) {
      const diagnosticResult = await diagnosticResponse.json();
      console.log('✅ Diagnóstico exitoso:', diagnosticResult.serviceStatus);
    } else {
      console.log('❌ Error en diagnóstico');
    }
    
    // Probar endpoint de templates
    console.log('📤 Probando endpoint de templates...');
    
    const templatesResponse = await fetch(`${baseUrl}/api/whatsapp/templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📥 Templates response status:', templatesResponse.status);
    
    if (templatesResponse.ok) {
      const templatesResult = await templatesResponse.json();
      console.log('✅ Templates obtenidos:', templatesResult.data?.length || 0);
    } else {
      console.log('❌ Error obteniendo templates');
    }
    
  } catch (error) {
    console.error('❌ Error en test directo:', error);
  }
};

// Ejecutar test
testDirectService();
