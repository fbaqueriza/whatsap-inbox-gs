// Script para verificar templates disponibles en Meta
const checkTemplates = async () => {
  try {
    console.log('🔍 Verificando templates disponibles...');
    
    const baseUrl = 'https://gastronomy-saas.vercel.app';
    
    console.log('📤 Consultando templates...');
    
    const response = await fetch(`${baseUrl}/api/whatsapp/templates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📥 Response status:', response.status);
    
    const result = await response.json();
    console.log('📥 Templates disponibles:', JSON.stringify(result, null, 2));
    
    // Buscar específicamente el template evio_orden
    if (result && Array.isArray(result)) {
      const evioOrdenTemplate = result.find(t => t.name === 'evio_orden');
      if (evioOrdenTemplate) {
        console.log('✅ Template evio_orden encontrado:', evioOrdenTemplate);
      } else {
        console.log('❌ Template evio_orden NO encontrado');
        console.log('📋 Templates disponibles:', result.map(t => t.name));
      }
    }
    
  } catch (error) {
    console.error('❌ Error verificando templates:', error);
  }
};

// Ejecutar verificación
checkTemplates();
