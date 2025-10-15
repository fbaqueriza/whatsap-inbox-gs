// Script para probar documentos en tiempo real
// Este script simula un documento entrante para verificar que aparece en el chat

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRealtimeDocument() {
  console.log('🧪 ===== TEST DE DOCUMENTO EN TIEMPO REAL =====\n');

  try {
    // 1. Obtener un proveedor de prueba
    console.log('📋 Paso 1: Buscando proveedor de prueba...');
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, phone, user_id')
      .limit(1)
      .single();

    if (providerError || !provider) {
      console.error('❌ Error obteniendo proveedor:', providerError);
      return;
    }

    console.log(`✅ Proveedor encontrado: ${provider.name} (${provider.phone})`);
    console.log(`   User ID: ${provider.user_id}\n`);

    // 2. Buscar un documento existente del proveedor
    console.log('📋 Paso 2: Buscando documento existente del proveedor...');
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, filename, file_url, mime_type')
      .eq('provider_id', provider.id)
      .limit(1)
      .single();

    if (docError || !document) {
      console.error('❌ No se encontró ningún documento para este proveedor');
      console.log('💡 Tip: Primero sube un documento desde WhatsApp o usa el script fix-documents-sync.js');
      return;
    }

    console.log(`✅ Documento encontrado: ${document.filename}`);
    console.log(`   URL: ${document.file_url}\n`);

    // 3. Crear mensaje con documento
    console.log('📋 Paso 3: Creando mensaje de documento de prueba...');
    const messageId = uuidv4();
    const messageData = {
      id: messageId,
      content: `📎 ${document.filename} (TEST ${new Date().toLocaleTimeString()})`,
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

    console.log('📨 Datos del mensaje con documento:', {
      id: messageData.id,
      content: messageData.content,
      contact_id: messageData.contact_id,
      user_id: messageData.user_id,
      media_url: messageData.media_url ? 'SÍ' : 'NO',
      media_type: messageData.media_type
    });

    // 4. Insertar mensaje
    console.log('\n📋 Paso 4: Insertando mensaje en la base de datos...');
    const { data: insertedMessage, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert([messageData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error insertando mensaje:', insertError);
      return;
    }

    console.log(`✅ Mensaje con documento insertado: ${insertedMessage.id}`);

    // 5. Verificar que se guardó con media_url
    console.log('\n📋 Paso 5: Verificando que el mensaje tiene media_url...');
    const { data: savedMessage, error: fetchError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !savedMessage) {
      console.error('❌ Error verificando mensaje:', fetchError);
      return;
    }

    console.log('✅ Mensaje verificado en la base de datos:');
    console.log('   ID:', savedMessage.id);
    console.log('   Contenido:', savedMessage.content);
    console.log('   Usuario:', savedMessage.user_id);
    console.log('   Contacto:', savedMessage.contact_id);
    console.log('   Media URL:', savedMessage.media_url ? '✅ SÍ' : '❌ NO');
    console.log('   Media Type:', savedMessage.media_type || 'N/A');

    // 6. Instrucciones finales
    console.log('\n' + '='.repeat(60));
    console.log('✅ MENSAJE DE DOCUMENTO CREADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log('\n📱 INSTRUCCIONES:');
    console.log('1. Abre la aplicación en el navegador');
    console.log('2. Abre la consola del navegador (F12)');
    console.log('3. Ve al chat y busca el contacto:', provider.name);
    console.log('4. Deberías ver el mensaje con documento INMEDIATAMENTE');
    console.log('5. El mensaje debe mostrar:');
    console.log('   ✓ Nombre del archivo:', document.filename);
    console.log('   ✓ Icono de documento');
    console.log('   ✓ Botón para descargar/abrir');
    console.log('\n💡 Si el documento NO aparece o no tiene botón de descarga:');
    console.log('   - Verifica en la consola: "isDocument: true"');
    console.log('   - Verifica en la consola: "mediaUrl: [url]"');
    console.log('   - Revisa que IntegratedChatPanel esté renderizando documentos');
    console.log('\n🔍 Para debugging en la consola del navegador:');
    console.log('   Busca el mensaje y expande para ver:');
    console.log('   - isDocument: debe ser true');
    console.log('   - mediaUrl: debe tener la URL del archivo');
    console.log('   - filename: debe tener el nombre del archivo');
    console.log('   - mediaType: debe tener el tipo MIME');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

testRealtimeDocument();

