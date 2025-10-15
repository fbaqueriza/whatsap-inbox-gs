// Script para verificar documentos y mensajes recientes
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentDocuments() {
  console.log('🔍 Verificando documentos y mensajes recientes...\n');

  try {
    // 1. Documentos más recientes (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    console.log('📋 Documentos creados en los últimos 5 minutos:');
    const { data: recentDocs, error: docsError } = await supabase
      .from('documents')
      .select(`
        id,
        filename,
        file_url,
        created_at,
        whatsapp_message_id,
        sender_phone,
        providers!inner(name, phone)
      `)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('❌ Error:', docsError);
    } else if (!recentDocs || recentDocs.length === 0) {
      console.log('   ❌ No hay documentos recientes');
    } else {
      console.log(`   ✅ ${recentDocs.length} documento(s) encontrado(s):\n`);
      recentDocs.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.filename}`);
        console.log(`      Proveedor: ${doc.providers.name} (${doc.providers.phone})`);
        console.log(`      Creado: ${new Date(doc.created_at).toLocaleString()}`);
        console.log(`      WhatsApp Message ID: ${doc.whatsapp_message_id || 'N/A'}`);
        console.log(`      URL: ${doc.file_url}`);
        console.log('');
      });

      // 2. Verificar si hay mensajes correspondientes
      console.log('📱 Verificando mensajes en whatsapp_messages:\n');
      
      for (const doc of recentDocs) {
        // Buscar por message_sid (WhatsApp ID) o por media_url
        const { data: messages, error: msgError } = await supabase
          .from('whatsapp_messages')
          .select('id, content, message_type, contact_id, user_id, media_url, created_at')
          .or(`message_sid.eq.${doc.whatsapp_message_id},media_url.eq.${doc.file_url}`);

        if (msgError) {
          console.log(`   ❌ Error buscando mensaje para ${doc.filename}:`, msgError.message);
        } else if (!messages || messages.length === 0) {
          console.log(`   ❌ NO HAY MENSAJE en whatsapp_messages para: ${doc.filename}`);
          console.log(`      WhatsApp Message ID: ${doc.whatsapp_message_id}`);
          console.log(`      ⚠️ ESTE ES EL PROBLEMA: El webhook NO creó el mensaje en el chat`);
          console.log('');
        } else {
          console.log(`   ✅ Mensaje encontrado para: ${doc.filename}`);
          messages.forEach(msg => {
            console.log(`      ID: ${msg.id}`);
            console.log(`      Contenido: ${msg.content}`);
            console.log(`      Tipo: ${msg.message_type}`);
            console.log(`      Contacto: ${msg.contact_id}`);
            console.log(`      User ID: ${msg.user_id}`);
            console.log(`      Media URL: ${msg.media_url ? 'SÍ' : 'NO'}`);
            console.log(`      Creado: ${new Date(msg.created_at).toLocaleString()}`);
          });
          console.log('');
        }
      }
    }

    // 3. Mensajes más recientes con media_url
    console.log('\n📎 Últimos 5 mensajes con documentos (media_url):\n');
    const { data: recentMessages } = await supabase
      .from('whatsapp_messages')
      .select('id, content, contact_id, media_url, media_type, created_at')
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentMessages && recentMessages.length > 0) {
      recentMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.content}`);
        console.log(`      Contacto: ${msg.contact_id}`);
        console.log(`      Media Type: ${msg.media_type}`);
        console.log(`      Creado: ${new Date(msg.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No hay mensajes con media_url');
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

checkRecentDocuments();

