// Script para verificar la API de mensajes del chat
require('dotenv').config();

async function checkChatAPI() {
  console.log('🧪 Verificando API de mensajes del chat...\n');
  
  // Obtener userId del usuario actual
  const userId = 'b5a237e6-c9f9-4561-af07-a1408825ab50'; // Usuario de prueba
  
  console.log(`📱 1. Llamando a API /api/whatsapp/messages con userId: ${userId}`);
  
  const response = await fetch(`http://localhost:3001/api/whatsapp/messages?userId=${userId}&limit=50`);
  const data = await response.json();
  
  console.log(`✅ Respuesta recibida: ${data.messages.length} mensajes`);
  
  // Filtrar mensajes con documentos
  const messagesWithDocs = data.messages.filter(msg => msg.media_url);
  
  console.log(`\n📎 Mensajes con documentos: ${messagesWithDocs.length}`);
  
  if (messagesWithDocs.length > 0) {
    console.log('\n📋 Detalles de mensajes con documentos:');
    messagesWithDocs.forEach((msg, i) => {
      console.log(`\n   ${i + 1}. ${msg.content}`);
      console.log(`      - ID: ${msg.id}`);
      console.log(`      - Contact ID: ${msg.contact_id}`);
      console.log(`      - User ID: ${msg.user_id}`);
      console.log(`      - Message Type: ${msg.message_type}`);
      console.log(`      - Media URL: ${msg.media_url ? 'SÍ' : 'NO'}`);
      console.log(`      - Media Type: ${msg.media_type || 'N/A'}`);
      console.log(`      - Timestamp: ${msg.timestamp}`);
    });
  } else {
    console.log('\n❌ NO HAY MENSAJES CON DOCUMENTOS EN LA API');
    console.log('   Verificando mensajes sin documentos:');
    data.messages.slice(0, 5).forEach((msg, i) => {
      console.log(`\n   ${i + 1}. ${msg.content.substring(0, 50)}...`);
      console.log(`      - Media URL: ${msg.media_url || 'NO'}`);
    });
  }
  
  // Verificar transformación en ChatContext
  console.log('\n\n🔄 2. Simulando transformación de ChatContext:');
  const transformedMessages = data.messages
    .map((msg) => {
      let messageType = 'received';
      
      if (msg.message_type === 'sent') {
        messageType = 'sent';
      } else if (msg.message_type === 'received') {
        messageType = 'received';
      } else if (msg.message_sid && (msg.message_sid.startsWith('sim_') || msg.message_sid.startsWith('msg_'))) {
        messageType = 'sent';
      }
      
      return {
        id: msg.message_sid || msg.id,
        content: msg.content,
        timestamp: new Date(msg.timestamp || msg.created_at),
        type: messageType,
        messageType: messageType,
        contact_id: msg.contact_id || msg.from,
        status: msg.status || 'delivered',
        isDocument: !!(msg.media_url),
        mediaUrl: msg.media_url,
        filename: msg.media_url ? msg.media_url.split('/').pop()?.split('_').slice(1).join('_') || 'documento' : undefined,
        fileSize: undefined,
        mediaType: msg.media_type
      };
    });
  
  const transformedWithDocs = transformedMessages.filter(msg => msg.isDocument);
  
  console.log(`✅ Mensajes transformados con documentos: ${transformedWithDocs.length}`);
  
  if (transformedWithDocs.length > 0) {
    console.log('\n📋 Detalles de mensajes transformados:');
    transformedWithDocs.forEach((msg, i) => {
      console.log(`\n   ${i + 1}. ${msg.content}`);
      console.log(`      - isDocument: ${msg.isDocument}`);
      console.log(`      - mediaUrl: ${msg.mediaUrl ? 'SÍ' : 'NO'}`);
      console.log(`      - filename: ${msg.filename || 'N/A'}`);
      console.log(`      - mediaType: ${msg.mediaType || 'N/A'}`);
    });
  } else {
    console.log('\n❌ NO HAY MENSAJES TRANSFORMADOS CON DOCUMENTOS');
  }
}

checkChatAPI().catch(console.error);
