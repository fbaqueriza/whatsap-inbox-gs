// Script para crear mensaje faltante del documento reciente
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMissingDocumentMessage() {
  console.log('🔧 Creando mensaje faltante para documento reciente...\n');

  try {
    // Buscar el documento sin mensaje (último 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: docs, error: docsError } = await supabase
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
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false });

    if (docsError || !docs || docs.length === 0) {
      console.log('❌ No se encontraron documentos recientes');
      return;
    }

    console.log(`📋 Encontrados ${docs.length} documento(s) reciente(s)`);

    for (const doc of docs) {
      console.log(`\n📄 Verificando: ${doc.filename}`);

      // Verificar si ya tiene mensaje
      const { data: existingMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('message_sid', doc.whatsapp_message_id)
        .single();

      if (existingMsg) {
        console.log('   ✅ Ya tiene mensaje, saltando');
        continue;
      }

      console.log('   ⚠️ NO tiene mensaje, creando...');

      // Crear mensaje
      const messageId = uuidv4();
      const messageData = {
        id: messageId,
        content: `📎 ${doc.filename}`,
        message_type: 'received',
        status: 'delivered',
        contact_id: doc.providers.phone, // Usar el teléfono del proveedor
        user_id: doc.user_id,
        message_sid: doc.whatsapp_message_id,
        timestamp: doc.created_at,
        created_at: doc.created_at,
        media_url: doc.file_url,
        media_type: doc.mime_type
      };

      console.log('   📱 Datos del mensaje:');
      console.log(`      ID: ${messageId}`);
      console.log(`      Contenido: ${messageData.content}`);
      console.log(`      Contacto: ${messageData.contact_id}`);
      console.log(`      User ID: ${messageData.user_id}`);
      console.log(`      Media URL: ${messageData.media_url ? 'SÍ' : 'NO'}`);

      const { error: insertError } = await supabase
        .from('whatsapp_messages')
        .insert([messageData]);

      if (insertError) {
        console.log(`   ❌ Error insertando mensaje:`, insertError.message);
      } else {
        console.log(`   ✅ Mensaje creado exitosamente: ${messageId}`);
        console.log(`   📱 El mensaje debería aparecer en el chat ahora`);
      }
    }

    console.log('\n✅ Proceso completado');
    console.log('\n📱 Abre el chat y busca a: La Mielisima');
    console.log('   El documento debe aparecer ahora con botón de descarga');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixMissingDocumentMessage();

