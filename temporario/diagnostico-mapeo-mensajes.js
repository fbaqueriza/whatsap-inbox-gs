require('dotenv').config({ path: '.env.local' });

console.log('🔍 DIAGNÓSTICO DE MAPEO DE MENSAJES');
console.log('===================================');

async function diagnosticoMapeo() {
  try {
    console.log('\n📊 1. VERIFICANDO DATOS DE LA API');
    console.log('-----------------------------------');
    
    // Obtener datos de la API
    const response = await fetch('http://localhost:3001/api/whatsapp/messages?limit=10&userId=test-user-id');
    const data = await response.json();
    
    console.log(`✅ API responde: ${response.status}`);
    console.log(`📊 Mensajes obtenidos: ${data.messages?.length || 0}`);
    
    if (data.messages && data.messages.length > 0) {
      console.log('\n📋 ANÁLISIS DE ESTRUCTURA DE DATOS:');
      
      // Analizar el primer mensaje en detalle
      const firstMessage = data.messages[0];
      console.log('🔍 Primer mensaje (estructura completa):');
      console.log(JSON.stringify(firstMessage, null, 2));
      
      console.log('\n📊 ANÁLISIS DE CAMPOS CRÍTICOS:');
      data.messages.slice(0, 5).forEach((msg, index) => {
        console.log(`\n📝 Mensaje ${index + 1}:`);
        console.log(`  - ID: ${msg.id}`);
        console.log(`  - message_sid: ${msg.message_sid || 'NULL'}`);
        console.log(`  - message_type: ${msg.message_type || 'NULL'}`);
        console.log(`  - content: ${msg.content?.substring(0, 50)}...`);
        console.log(`  - contact_id: ${msg.contact_id}`);
        console.log(`  - user_id: ${msg.user_id || 'NULL'}`);
        console.log(`  - timestamp: ${msg.timestamp}`);
        console.log(`  - created_at: ${msg.created_at}`);
      });
      
      console.log('\n🔧 2. SIMULANDO MAPEO DEL CHATCONTEXT');
      console.log('--------------------------------------');
      
      // Simular el mapeo que hace el ChatContext
      const transformedMessages = data.messages.map((msg) => {
        // Determinar el tipo de mensaje correctamente
        let messageType = 'received';
        
        // Si el mensaje tiene message_type explícito, usarlo
        if (msg.message_type === 'sent') {
          messageType = 'sent';
        } else if (msg.message_type === 'received') {
          messageType = 'received';
        } else {
          // Si no hay message_type explícito, intentar determinar por otros campos
          if (msg.message_sid && (msg.message_sid.startsWith('sim_') || msg.message_sid.startsWith('msg_'))) {
            messageType = 'sent';
          }
        }
        
        return {
          id: msg.message_sid || msg.id,
          content: msg.content,
          timestamp: new Date(msg.timestamp || msg.created_at),
          type: messageType,
          contact_id: msg.contact_id || msg.from,
          status: msg.status || 'delivered'
        };
      });
      
      console.log('📋 RESULTADO DEL MAPEO:');
      transformedMessages.slice(0, 5).forEach((msg, index) => {
        console.log(`\n📝 Mensaje mapeado ${index + 1}:`);
        console.log(`  - ID: ${msg.id}`);
        console.log(`  - type: ${msg.type}`);
        console.log(`  - content: ${msg.content?.substring(0, 50)}...`);
        console.log(`  - contact_id: ${msg.contact_id}`);
        console.log(`  - timestamp: ${msg.timestamp}`);
      });
      
      console.log('\n🎯 3. ANÁLISIS DE PROBLEMAS');
      console.log('---------------------------');
      
      // Contar tipos de mensajes
      const sentCount = transformedMessages.filter(m => m.type === 'sent').length;
      const receivedCount = transformedMessages.filter(m => m.type === 'received').length;
      
      console.log(`📊 Distribución de tipos:`);
      console.log(`  - Enviados (sent): ${sentCount}`);
      console.log(`  - Recibidos (received): ${receivedCount}`);
      
      // Verificar mensajes con message_type NULL/undefined
      const undefinedTypeCount = data.messages.filter(m => !m.message_type).length;
      console.log(`  - Con message_type NULL/undefined: ${undefinedTypeCount}`);
      
      // Verificar message_sid
      const withMessageSid = data.messages.filter(m => m.message_sid).length;
      console.log(`  - Con message_sid: ${withMessageSid}`);
      
      console.log('\n🔍 4. RECOMENDACIONES');
      console.log('-------------------');
      
      if (undefinedTypeCount > 0) {
        console.log('⚠️ PROBLEMA: Hay mensajes con message_type NULL/undefined');
        console.log('   → Revisar lógica de guardado en la base de datos');
        console.log('   → Verificar webhook de WhatsApp');
      }
      
      if (sentCount === 0 && receivedCount === 0) {
        console.log('⚠️ PROBLEMA: No se pudo determinar el tipo de ningún mensaje');
        console.log('   → Revisar lógica de mapeo en ChatContext');
      }
      
      if (sentCount > 0 || receivedCount > 0) {
        console.log('✅ El mapeo está funcionando correctamente');
        console.log('   → Los mensajes deberían aparecer en el chat');
      }
      
    } else {
      console.log('❌ No hay mensajes para analizar');
    }
    
    console.log('\n✅ DIAGNÓSTICO COMPLETADO');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnosticoMapeo();
