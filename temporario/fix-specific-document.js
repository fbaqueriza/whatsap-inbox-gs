// Script para crear mensaje para el documento específico de los logs
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSpecificDocument() {
  console.log('🔧 Buscando documento de los logs de Vercel...\n');

  try {
    // Buscar por ID específico del log
    const documentId = '31235c04-c4c5-4cf2-9869-88fc21e139ad';
    
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(`
        id,
        filename,
        file_url,
        mime_type,
        whatsapp_message_id,
        sender_phone,
        user_id,
        provider_id,
        created_at,
        providers!inner(name, phone)
      `)
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      console.log('❌ Documento no encontrado por ID, buscando por nombre...');
      
      // Buscar por nombre de archivo
      const { data: docs, error: err } = await supabase
        .from('documents')
        .select(`
          id,
          filename,
          file_url,
          mime_type,
          whatsapp_message_id,
          sender_phone,
          user_id,
          provider_id,
          created_at,
          providers!inner(name, phone)
        `)
        .ilike('filename', '%2025-10-10_16-06%')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (err || !docs || docs.length === 0) {
        console.log('❌ No se encontró el documento');
        return;
      }
      
      const document = docs[0];
      console.log('✅ Documento encontrado:', document.filename);
      await createMessageForDocument(document);
    } else {
      console.log('✅ Documento encontrado:', doc.filename);
      await createMessageForDocument(doc);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function createMessageForDocument(doc) {
  // Verificar si ya tiene mensaje
  const { data: existingMsg } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('message_sid', doc.whatsapp_message_id)
    .single();

  if (existingMsg) {
    console.log('✅ Ya tiene mensaje en el chat');
    return;
  }

  console.log('⚠️ NO tiene mensaje, creando...');
  console.log('   Proveedor:', doc.providers.name);
  console.log('   Archivo:', doc.filename);
  console.log('   Creado:', new Date(doc.created_at).toLocaleString());

  const messageId = uuidv4();
  const messageData = {
    id: messageId,
    content: `📎 ${doc.filename}`,
    message_type: 'received',
    status: 'delivered',
    contact_id: doc.providers.phone,
    user_id: doc.user_id,
    message_sid: doc.whatsapp_message_id,
    timestamp: doc.created_at,
    created_at: doc.created_at,
    media_url: doc.file_url,
    media_type: doc.mime_type
  };

  const { error: insertError } = await supabase
    .from('whatsapp_messages')
    .insert([messageData]);

  if (insertError) {
    console.log('❌ Error:', insertError.message);
  } else {
    console.log('✅ Mensaje creado:', messageId);
    console.log('\n📱 El documento debe aparecer en el chat ahora');
  }
}

fixSpecificDocument();

