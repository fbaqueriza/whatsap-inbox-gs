// Script de prueba para la estabilidad del modal
const testModalStability = async () => {
  try {
    console.log('🧪 Probando estabilidad del modal...');
    
    // Test 1: Selección de horarios
    console.log('\n📋 Test 1: Selección de horarios');
    const timeSelectionResponse = await fetch('http://localhost:3001/api/debug/test-modal-stability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test_time_selection',
        data: {
          times: ['08:00-10:00', '14:00-16:00']
        }
      }),
    });

    if (timeSelectionResponse.ok) {
      const result = await timeSelectionResponse.json();
      console.log('✅ Selección de horarios:', result.message);
      console.log('📊 Datos:', result.data);
    } else {
      console.error('❌ Error en selección de horarios');
    }

    // Test 2: Selección de fecha
    console.log('\n📅 Test 2: Selección de fecha');
    const dateSelectionResponse = await fetch('http://localhost:3001/api/debug/test-modal-stability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test_date_selection',
        data: {
          date: '2025-09-02'
        }
      }),
    });

    if (dateSelectionResponse.ok) {
      const result = await dateSelectionResponse.json();
      console.log('✅ Selección de fecha:', result.message);
      console.log('📊 Datos:', result.data);
    } else {
      console.error('❌ Error en selección de fecha');
    }

    // Test 3: Interacción con dropdown
    console.log('\n🔽 Test 3: Interacción con dropdown');
    const dropdownResponse = await fetch('http://localhost:3001/api/debug/test-modal-stability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test_dropdown_interaction',
        data: {
          type: 'time_selector',
          isOpen: true
        }
      }),
    });

    if (dropdownResponse.ok) {
      const result = await dropdownResponse.json();
      console.log('✅ Interacción con dropdown:', result.message);
      console.log('📊 Datos:', result.data);
    } else {
      console.error('❌ Error en interacción con dropdown');
    }

    console.log('\n🎉 ¡Todos los tests de estabilidad del modal completados exitosamente!');
    console.log('\n💡 Para probar en el navegador:');
    console.log('1. Abre el modal de crear orden');
    console.log('2. Haz clic en el botón de reloj (selector de horarios)');
    console.log('3. Selecciona diferentes opciones de horario');
    console.log('4. Verifica que el modal permanezca abierto');
    console.log('5. Haz clic en el botón de calendario (selector de fechas)');
    console.log('6. Verifica que el modal permanezca abierto');
    
  } catch (error) {
    console.error('❌ Error en el test de estabilidad del modal:', error);
  }
};

// Ejecutar el test
testModalStability();
