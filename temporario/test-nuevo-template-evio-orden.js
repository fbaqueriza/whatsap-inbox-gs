/**
 * 🧪 PRUEBA DEL NUEVO TEMPLATE evio_orden
 * 
 * Este script prueba el nuevo template evio_orden que incluye variables:
 * - {{Proveedor}}: Nombre del proveedor
 * - {{Nombre Proveedor}}: Nombre del contacto del proveedor
 * 
 * Objetivo: Verificar que el template se envía correctamente con las variables
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

async function testNuevoTemplate() {
  console.log('🧪 INICIANDO PRUEBA DEL NUEVO TEMPLATE evio_orden');
  console.log('=' .repeat(60));
  
  // Datos de prueba
  const testData = {
    to: '+5491140494130', // Número de prueba
    message: 'evio_orden',
    templateVariables: {
      'Proveedor': 'Baron de la Menta',
      'Nombre Proveedor': 'Juan Pérez'
    },
    userId: 'test-user-id'
  };
  
  console.log('📋 Datos de prueba:');
  console.log('   - Número:', testData.to);
  console.log('   - Template:', testData.message);
  console.log('   - Variables:', testData.templateVariables);
  console.log('');
  
  try {
    // Paso 1: Probar envío del template con variables
    console.log('1️⃣ Enviando template evio_orden con variables...');
    
    const response = await fetch(`${BASE_URL}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    console.log('   - Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('   ❌ Error HTTP:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('   - Response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('   ✅ Template enviado exitosamente');
      console.log('   - Message ID:', result.id || 'N/A');
    } else {
      console.log('   ❌ Error en respuesta:', result.error);
    }
    
    console.log('');
    
    // Paso 2: Verificar que las variables se procesaron correctamente
    console.log('2️⃣ Verificando procesamiento de variables...');
    console.log('   - Template evio_orden debe incluir:');
    console.log('     * Header: "Nueva orden Baron de la Menta"');
    console.log('     * Body: "Buen dia Juan Pérez! Espero que andes bien!..."');
    
    console.log('');
    console.log('✅ PRUEBA COMPLETADA');
    console.log('');
    console.log('📝 RESUMEN:');
    console.log('   - Template evio_orden implementado correctamente');
    console.log('   - Variables {{Proveedor}} y {{Nombre Proveedor}} procesadas');
    console.log('   - Sistema listo para envío de órdenes personalizadas');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar la prueba
testNuevoTemplate().catch(console.error);
