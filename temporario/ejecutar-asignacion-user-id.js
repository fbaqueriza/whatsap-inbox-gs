require('dotenv').config({ path: '.env.local' });

async function ejecutarAsignacionUserId() {
  console.log('🔧 EJECUTANDO ASIGNACIÓN DE USER_ID A MENSAJES\n');

  try {
    // Llamar a la API de asignación
    console.log('📡 Llamando a la API de asignación...');
    const response = await fetch('http://localhost:3001/api/whatsapp/assign-user-to-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('❌ Error en la respuesta de la API:', response.status, response.statusText);
      return;
    }

    const result = await response.json();
    
    console.log('\n✅ RESULTADO DE LA ASIGNACIÓN:');
    console.log(`📊 Total procesados: ${result.totalProcessed}`);
    console.log(`✅ Asignados: ${result.assignedCount}`);
    console.log(`⚠️ Omitidos: ${result.skippedCount}`);
    
    if (result.success) {
      console.log('\n🎉 ¡ASIGNACIÓN COMPLETADA EXITOSAMENTE!');
      console.log('\n📋 RESUMEN:');
      console.log('✅ Los mensajes recibidos ahora tienen user_id del usuario de la app');
      console.log('✅ El sistema está listo para múltiples usuarios');
      console.log('✅ La API de mensajes ahora filtrará correctamente por usuario');
    } else {
      console.log('\n❌ Error en la asignación:', result.error);
    }

  } catch (error) {
    console.error('❌ Error ejecutando asignación:', error);
  }
}

ejecutarAsignacionUserId();
