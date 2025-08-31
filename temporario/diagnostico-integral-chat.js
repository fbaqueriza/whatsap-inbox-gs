require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticarChatIntegral() {
  console.log('🔍 DIAGNÓSTICO INTEGRAL DEL CHAT\n');

  try {
    // 1. Verificar mensajes en la base de datos
    console.log('📊 1. ANÁLISIS DE BASE DE DATOS');
    const { data: mensajesDB, error: errorDB } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (errorDB) {
      console.error('❌ Error obteniendo mensajes de DB:', errorDB);
    } else {
      console.log(`✅ Total mensajes en DB: ${mensajesDB.length}`);
      console.log('📝 Últimos 5 mensajes:');
      mensajesDB.slice(0, 5).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.message_type} | ${msg.contact_id} | ${msg.content?.substring(0, 50)}...`);
      });
    }

    // 2. Verificar API endpoint
    console.log('\n🌐 2. ANÁLISIS DE API ENDPOINT');
    const testUserId = 'test-user-id';
    
    try {
      const response = await fetch(`http://localhost:3001/api/whatsapp/messages?userId=${testUserId}&limit=20`);
      const data = await response.json();
      
      console.log(`✅ API Status: ${response.status}`);
      console.log(`📥 Mensajes recibidos: ${data.messages?.length || 0}`);
      
      if (data.messages && data.messages.length > 0) {
        const sentCount = data.messages.filter(m => m.message_type === 'sent').length;
        const receivedCount = data.messages.filter(m => m.message_type === 'received').length;
        console.log(`📤 Enviados: ${sentCount}, 📥 Recibidos: ${receivedCount}`);
      }
    } catch (apiError) {
      console.error('❌ Error llamando API:', apiError.message);
    }

    // 3. Verificar proveedores registrados
    console.log('\n👥 3. ANÁLISIS DE PROVEEDORES');
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('phone');

    if (providersError) {
      console.error('❌ Error obteniendo proveedores:', providersError);
    } else {
      console.log(`✅ Proveedores registrados: ${providers.length}`);
      providers.forEach(p => console.log(`  📞 ${p.phone}`));
    }

    // 4. Verificar configuración de Realtime
    console.log('\n⚡ 4. ANÁLISIS DE REALTIME');
    try {
      const realtimeResponse = await fetch('http://localhost:3001/api/whatsapp/messages/sse');
      console.log(`✅ SSE Status: ${realtimeResponse.status}`);
    } catch (sseError) {
      console.log(`❌ SSE Error: ${sseError.message}`);
    }

    // 5. Verificar filtros de ChatContext
    console.log('\n🔍 5. ANÁLISIS DE FILTROS');
    const argentineNumbers = ['+5491135562673', '+5491135562674'];
    const testMessages = [
      { contact_id: '+5491135562673', message_type: 'received' },
      { contact_id: '+670680919470999', message_type: 'sent' },
      { contact_id: '+5491135562674', message_type: 'received' }
    ];

    console.log('🧪 Simulando filtros de ChatContext:');
    testMessages.forEach((msg, i) => {
      const contactId = msg.contact_id;
      const isFromRegisteredProvider = argentineNumbers.includes(contactId);
      const isArgentineNumber = contactId.includes('+549');
      const shouldInclude = isFromRegisteredProvider || isArgentineNumber;
      
      console.log(`  ${i + 1}. ${contactId} | Provider: ${isFromRegisteredProvider} | Argentine: ${isArgentineNumber} | Include: ${shouldInclude}`);
    });

    console.log('\n✅ DIAGNÓSTICO COMPLETADO');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

diagnosticarChatIntegral();
