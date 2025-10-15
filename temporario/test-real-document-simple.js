// Script simple para probar documento real
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testRealDocument() {
  console.log('🧪 Probando envío de documento real...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // 1. Verificar mensajes actuales con documentos
  console.log('📊 1. Verificando mensajes con documentos actuales...');
  const { data: currentMessages, error: currentError } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (currentError) {
    console.error('❌ Error:', currentError);
  } else {
    console.log(`✅ Mensajes con documentos encontrados: ${currentMessages.length}`);
    currentMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.content}`);
      console.log(`      - ID: ${msg.id}`);
      console.log(`      - Contact ID: ${msg.contact_id}`);
      console.log(`      - User ID: ${msg.user_id}`);
      console.log(`      - Media URL: ${msg.media_url ? 'SÍ' : 'NO'}`);
      console.log(`      - Media Type: ${msg.media_type || 'N/A'}`);
      console.log(`      - Created: ${msg.created_at}`);
    });
  }
  
  console.log('\n📱 2. Enviando documento desde proveedor...');
  console.log('   ⏳ Por favor, envía un documento desde WhatsApp del proveedor ahora...');
  console.log('   ⏳ Esperando 10 segundos...\n');
  
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('📊 3. Verificando nuevos mensajes con documentos...');
  const { data: newMessages, error: newError } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (newError) {
    console.error('❌ Error:', newError);
  } else {
    console.log(`✅ Mensajes con documentos encontrados: ${newMessages.length}`);
    
    // Comparar con mensajes anteriores
    const newMessageIds = new Set(currentMessages.map(m => m.id));
    const reallyNewMessages = newMessages.filter(m => !newMessageIds.has(m.id));
    
    if (reallyNewMessages.length > 0) {
      console.log(`\n🎉 ¡NUEVO DOCUMENTO DETECTADO!`);
      reallyNewMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.content}`);
        console.log(`      - ID: ${msg.id}`);
        console.log(`      - Contact ID: ${msg.contact_id}`);
        console.log(`      - User ID: ${msg.user_id}`);
        console.log(`      - Media URL: ${msg.media_url}`);
        console.log(`      - Media Type: ${msg.media_type || 'N/A'}`);
        console.log(`      - Created: ${msg.created_at}`);
      });
    } else {
      console.log(`\n❌ NO SE DETECTÓ NINGÚN DOCUMENTO NUEVO`);
      console.log('   Posibles causas:');
      console.log('   1. El webhook no recibió el mensaje');
      console.log('   2. El webhook falló al procesar el documento');
      console.log('   3. El documento se guardó en tabla documents pero no en whatsapp_messages');
    }
  }
  
  console.log('\n📊 4. Verificando documentos en tabla documents...');
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (docsError) {
    console.error('❌ Error:', docsError);
  } else {
    console.log(`✅ Documentos encontrados: ${documents.length}`);
    documents.forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.filename}`);
      console.log(`      - ID: ${doc.id}`);
      console.log(`      - Sender Phone: ${doc.sender_phone || 'N/A'}`);
      console.log(`      - Provider ID: ${doc.provider_id || 'N/A'}`);
      console.log(`      - WhatsApp Message ID: ${doc.whatsapp_message_id || 'N/A'}`);
      console.log(`      - Created: ${doc.created_at}`);
    });
  }
}

testRealDocument().catch(console.error);
