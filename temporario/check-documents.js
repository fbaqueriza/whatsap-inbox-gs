const { createClient } = require('@supabase/supabase-js');

async function checkDocuments() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('🔍 Verificando documentos en la base de datos...');
  
  // Verificar documentos existentes
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, filename, file_type, created_at, sender_phone, whatsapp_message_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (docsError) {
    console.error('❌ Error obteniendo documentos:', docsError);
    return;
  }
  
  console.log(`📎 Documentos encontrados: ${documents.length}`);
  documents.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.filename} (${doc.file_type}) - ${doc.created_at}`);
    console.log(`   Sender: ${doc.sender_phone}, WhatsApp Message ID: ${doc.whatsapp_message_id || 'NO ASIGNADO'}`);
  });
  
  // Verificar mensajes de WhatsApp con documentos
  const { data: messages, error: msgsError } = await supabase
    .from('whatsapp_messages')
    .select('id, content, media_url, media_type, created_at, contact_id')
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (msgsError) {
    console.error('❌ Error obteniendo mensajes con documentos:', msgsError);
    return;
  }
  
  console.log(`\n📱 Mensajes con documentos en chat: ${messages.length}`);
  messages.forEach((msg, index) => {
    console.log(`${index + 1}. ${msg.content} (${msg.media_type}) - ${msg.created_at}`);
    console.log(`   Contact: ${msg.contact_id}, URL: ${msg.media_url}`);
  });
  
  // Verificar proveedores
  const { data: providers, error: provError } = await supabase
    .from('providers')
    .select('id, name, phone, user_id')
    .limit(5);
  
  if (provError) {
    console.error('❌ Error obteniendo proveedores:', provError);
    return;
  }
  
  console.log(`\n👥 Proveedores encontrados: ${providers.length}`);
  providers.forEach((prov, index) => {
    console.log(`${index + 1}. ${prov.name} (${prov.phone}) - User ID: ${prov.user_id}`);
  });
}

checkDocuments().catch(console.error);
