// Script para probar mensajes en tiempo real
// Este script simula un mensaje entrante para verificar que el sistema de tiempo real funciona

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRealtimeMessage() {
  console.log('🧪 ===== TEST DE MENSAJE EN TIEMPO REAL =====\n');

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

    // 2. Crear mensaje de prueba
    console.log('📋 Paso 2: Creando mensaje de prueba...');
    const messageId = uuidv4();
    const messageData = {
      id: messageId,
      content: `🧪 Mensaje de prueba - ${new Date().toLocaleTimeString()}`,
      message_type: 'received',
      status: 'delivered',
      contact_id: provider.phone,
      user_id: provider.user_id,
      message_sid: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    console.log('📨 Datos del mensaje:', {
      id: messageData.id,
      content: messageData.content,
      contact_id: messageData.contact_id,
      user_id: messageData.user_id
    });

    // 3. Insertar mensaje
    console.log('\n📋 Paso 3: Insertando mensaje en la base de datos...');
    const { data: insertedMessage, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert([messageData])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error insertando mensaje:', insertError);
      return;
    }

    console.log(`✅ Mensaje insertado exitosamente: ${insertedMessage.id}`);

    // 4. Verificar que se guardó
    console.log('\n📋 Paso 4: Verificando que el mensaje se guardó correctamente...');
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

    // 5. Instrucciones finales
    console.log('\n' + '='.repeat(60));
    console.log('✅ MENSAJE DE PRUEBA CREADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log('\n📱 INSTRUCCIONES:');
    console.log('1. Abre la aplicación en el navegador');
    console.log('2. Abre la consola del navegador (F12)');
    console.log('3. Ve al chat y busca el contacto:', provider.name);
    console.log('4. Deberías ver el mensaje de prueba INMEDIATAMENTE');
    console.log('5. Busca en la consola del navegador estos logs:');
    console.log('   - "🔍 [RealtimeService] Nuevo mensaje recibido"');
    console.log('   - "✅ [RealtimeService] Agregando nuevo mensaje al estado"');
    console.log('\n💡 Si el mensaje NO aparece inmediatamente:');
    console.log('   - Verifica que el filtro de realtime esté activo');
    console.log('   - Revisa la consola del navegador por errores');
    console.log('   - Confirma que estás autenticado como user_id:', provider.user_id);
    console.log('\n🔍 Para verificar la suscripción de realtime:');
    console.log('   Busca en la consola: "✅ RealtimeService: Suscripción a whatsapp_messages activa"');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

testRealtimeMessage();

