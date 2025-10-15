const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🧪 Test documento La Mielisima\n');
  
  const { data: provider } = await supabase
    .from('providers')
    .select('id, name, phone, user_id')
    .ilike('name', '%mielisima%')
    .single();
  
  if (!provider) {
    console.log('❌ Proveedor no encontrado');
    return;
  }
  
  console.log('✅ Proveedor:', provider.name);
  
  const { data: document } = await supabase
    .from('documents')
    .select('id, filename, file_url, mime_type')
    .eq('provider_id', provider.id)
    .limit(1)
    .single();
  
  if (!document) {
    console.log('❌ Sin documentos');
    return;
  }
  
  console.log('✅ Documento:', document.filename);
  
  const messageId = uuidv4();
  const messageData = {
    id: messageId,
    content: `📎 ${document.filename}`,
    message_type: 'received',
    status: 'delivered',
    contact_id: provider.phone,
    user_id: provider.user_id,
    message_sid: `test_doc_${Date.now()}`,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    media_url: document.file_url,
    media_type: document.mime_type
  };
  
  const { data: result, error } = await supabase
    .from('whatsapp_messages')
    .insert([messageData])
    .select()
    .single();
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('\n✅ Mensaje con documento creado:', messageId);
    console.log('📎 Archivo:', document.filename);
    console.log('📱 Contacto:', provider.name);
    console.log('🌐 Media URL:', document.file_url ? 'SÍ' : 'NO');
    console.log('\n📱 Abre el chat y busca a:', provider.name);
    console.log('El documento debe aparecer INMEDIATAMENTE con botón de descarga');
  }
})();

