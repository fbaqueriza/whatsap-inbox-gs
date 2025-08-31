require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 VERIFICANDO MENSAJES RECIBIDOS');
console.log('==================================');

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verificarMensajesRecibidos() {
  try {
    console.log('\n📊 1. ANÁLISIS DE MENSAJES EN BASE DE DATOS');
    console.log('---------------------------------------------');
    
    // Contar mensajes por tipo
    const { data: sentMessages, error: sentError } = await supabase
      .from('whatsapp_messages')
      .select('id, content, contact_id, message_type')
      .eq('message_type', 'sent');
    
    const { data: receivedMessages, error: receivedError } = await supabase
      .from('whatsapp_messages')
      .select('id, content, contact_id, message_type')
      .eq('message_type', 'received');
    
    if (sentError || receivedError) {
      console.log('❌ Error consultando mensajes:', sentError || receivedError);
      return;
    }
    
    console.log(`📤 Mensajes enviados: ${sentMessages?.length || 0}`);
    console.log(`📥 Mensajes recibidos: ${receivedMessages?.length || 0}`);
    
    if (receivedMessages && receivedMessages.length > 0) {
      console.log('\n📋 MENSAJES RECIBIDOS ENCONTRADOS:');
      receivedMessages.slice(0, 5).forEach((msg, index) => {
        console.log(`\n📝 Mensaje recibido ${index + 1}:`);
        console.log(`  - ID: ${msg.id}`);
        console.log(`  - Content: ${msg.content?.substring(0, 50)}...`);
        console.log(`  - Contact: ${msg.contact_id}`);
        console.log(`  - Type: ${msg.message_type}`);
      });
    } else {
      console.log('\n⚠️ NO HAY MENSAJES RECIBIDOS EN LA BASE DE DATOS');
    }
    
    console.log('\n🔧 2. VERIFICANDO FILTROS DEL CHATCONTEXT');
    console.log('------------------------------------------');
    
    // Verificar qué contactos están siendo filtrados
    const { data: allMessages, error: allError } = await supabase
      .from('whatsapp_messages')
      .select('contact_id, message_type')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (allError) {
      console.log('❌ Error consultando todos los mensajes:', allError);
      return;
    }
    
    // Simular el filtrado del ChatContext
    const argentineMessages = allMessages?.filter(msg => 
      msg.contact_id && msg.contact_id.includes('+549')
    ) || [];
    
    const argentineReceived = argentineMessages.filter(msg => msg.message_type === 'received');
    const argentineSent = argentineMessages.filter(msg => msg.message_type === 'sent');
    
    console.log(`🇦🇷 Mensajes argentinos totales: ${argentineMessages.length}`);
    console.log(`  - Enviados: ${argentineSent.length}`);
    console.log(`  - Recibidos: ${argentineReceived.length}`);
    
    // Verificar contactos únicos
    const uniqueContacts = [...new Set(allMessages?.map(m => m.contact_id) || [])];
    console.log(`\n📱 Contactos únicos en BD: ${uniqueContacts.length}`);
    uniqueContacts.forEach(contact => {
      const contactMessages = allMessages?.filter(m => m.contact_id === contact) || [];
      const sent = contactMessages.filter(m => m.message_type === 'sent').length;
      const received = contactMessages.filter(m => m.message_type === 'received').length;
      console.log(`  - ${contact}: ${sent} enviados, ${received} recibidos`);
    });
    
    console.log('\n🎯 3. VERIFICANDO API CON FILTROS');
    console.log('---------------------------------');
    
    // Probar la API con diferentes límites
    try {
      const response = await fetch('http://localhost:3001/api/whatsapp/messages?limit=100&userId=test-user-id');
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        const apiReceived = data.messages.filter(m => m.message_type === 'received');
        const apiSent = data.messages.filter(m => m.message_type === 'sent');
        
        console.log(`📊 API devuelve: ${data.messages.length} mensajes`);
        console.log(`  - Enviados: ${apiSent.length}`);
        console.log(`  - Recibidos: ${apiReceived.length}`);
        
        if (apiReceived.length > 0) {
          console.log('\n📋 MENSAJES RECIBIDOS EN API:');
          apiReceived.slice(0, 3).forEach((msg, index) => {
            console.log(`\n📝 ${index + 1}. ID: ${msg.id}`);
            console.log(`   Content: ${msg.content?.substring(0, 50)}...`);
            console.log(`   Contact: ${msg.contact_id}`);
            console.log(`   Type: ${msg.message_type}`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Error consultando API:', error.message);
    }
    
    console.log('\n🔍 4. DIAGNÓSTICO FINAL');
    console.log('------------------------');
    
    if (receivedMessages && receivedMessages.length > 0) {
      console.log('✅ Hay mensajes recibidos en la base de datos');
      console.log('🔍 Verificar por qué no aparecen en el chat:');
      console.log('   → Revisar filtros del ChatContext');
      console.log('   → Verificar normalización de contactos');
      console.log('   → Comprobar que los contactos sean argentinos (+549)');
    } else {
      console.log('⚠️ NO HAY MENSAJES RECIBIDOS EN LA BASE DE DATOS');
      console.log('🔍 Posibles causas:');
      console.log('   → Webhook de WhatsApp no está guardando mensajes recibidos');
      console.log('   → Los mensajes se guardan con message_type incorrecto');
      console.log('   → No hay mensajes entrantes reales');
    }
    
    console.log('\n✅ VERIFICACIÓN COMPLETADA');
    
  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verificarMensajesRecibidos();
