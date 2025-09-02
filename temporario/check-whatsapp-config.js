// Script para verificar configuración de WhatsApp
const checkWhatsAppConfig = async () => {
  try {
    console.log('🔍 Verificando configuración de WhatsApp...');
    
    const baseUrl = 'https://gastronomy-saas.vercel.app';
    
    // Verificar endpoint de diagnóstico
    console.log('📤 Consultando diagnóstico...');
    
    const response = await fetch(`${baseUrl}/api/whatsapp/diagnostic`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📥 Response status:', response.status);
    
    const result = await response.json();
    console.log('📥 Diagnóstico:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error verificando configuración:', error);
  }
};

// Ejecutar verificación
checkWhatsAppConfig();
