require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigarConsultaOR() {
  console.log('🔍 INVESTIGACIÓN DE CONSULTA OR\n');

  try {
    // 1. Obtener usuario y proveedores
    const { data: users } = await supabase.from('users').select('id').limit(1);
    const testUserId = users[0].id;
    
    const { data: userProviders } = await supabase
      .from('providers')
      .select('phone')
      .eq('user_id', testUserId);
    
    const userProviderPhones = userProviders?.map(p => p.phone) || [];
    
    console.log(`👤 Usuario: ${testUserId}`);
    console.log(`📞 Proveedores: ${userProviderPhones.join(', ')}`);
    
    // 2. Verificar mensajes recibidos en la base de datos
    console.log('\n🗄️ 2. MENSAJES RECIBIDOS EN BASE DE DATOS');
    const { data: receivedMessages } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('message_type', 'received')
      .order('created_at', { ascending: false });
    
    console.log(`✅ Total mensajes recibidos en DB: ${receivedMessages.length}`);
    
    receivedMessages.slice(0, 5).forEach((msg, i) => {
      console.log(`  ${i + 1}. contact_id: ${msg.contact_id}, user_id: ${msg.user_id || 'NULL'}, content: ${msg.content?.substring(0, 30)}...`);
    });
    
    // 3. Probar consultas individuales
    console.log('\n🔧 3. PROBANDO CONSULTAS INDIVIDUALES');
    
    // Consulta 1: user_id.eq
    const { data: userMessages } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false });
    
    console.log(`📤 Mensajes con user_id=${testUserId}: ${userMessages.length}`);
    
    // Consulta 2: user_id.is.null
    const { data: nullUserMessages } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .is('user_id', null)
      .order('created_at', { ascending: false });
    
    console.log(`📤 Mensajes con user_id=NULL: ${nullUserMessages.length}`);
    
    // Consulta 3: contact_id.in
    if (userProviderPhones.length > 0) {
      const { data: providerMessages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('contact_id', userProviderPhones)
        .order('created_at', { ascending: false });
      
      console.log(`📤 Mensajes con contact_id en proveedores: ${providerMessages.length}`);
    }
    
    // 4. Probar consulta OR manual
    console.log('\n🔧 4. PROBANDO CONSULTA OR MANUAL');
    
    // Construir la consulta OR paso a paso
    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Probar diferentes combinaciones
    console.log('\n📊 Probando combinaciones:');
    
    // Combinación 1: Solo user_id.eq
    const { data: combo1 } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    console.log(`  🔧 user_id.eq: ${combo1.length} mensajes`);
    
    // Combinación 2: Solo user_id.is.null
    const { data: combo2 } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(20);
    
    console.log(`  🔧 user_id.is.null: ${combo2.length} mensajes`);
    
    // Combinación 3: Solo contact_id.in
    if (userProviderPhones.length > 0) {
      const { data: combo3 } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('contact_id', userProviderPhones)
        .order('created_at', { ascending: false })
        .limit(20);
      
      console.log(`  🔧 contact_id.in: ${combo3.length} mensajes`);
    }
    
    // 5. Probar consulta OR con sintaxis correcta
    console.log('\n🔧 5. PROBANDO CONSULTA OR CON SINTAXIS CORRECTA');
    
    // Probar con sintaxis de Supabase para OR
    const { data: orQuery1 } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .or(`user_id.eq.${testUserId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(20);
    
    console.log(`✅ OR query (user_id): ${orQuery1.length} mensajes`);
    
    // 6. Verificar si los mensajes recibidos están siendo incluidos
    console.log('\n📥 6. VERIFICANDO MENSAJES RECIBIDOS EN CONSULTAS');
    
    const receivedInCombo1 = combo1.filter(m => m.message_type === 'received').length;
    const receivedInCombo2 = combo2.filter(m => m.message_type === 'received').length;
    const receivedInOrQuery = orQuery1.filter(m => m.message_type === 'received').length;
    
    console.log(`📥 Mensajes recibidos en user_id.eq: ${receivedInCombo1}`);
    console.log(`📥 Mensajes recibidos en user_id.is.null: ${receivedInCombo2}`);
    console.log(`📥 Mensajes recibidos en OR query: ${receivedInOrQuery}`);
    
    // 7. Probar consulta final corregida
    console.log('\n🔧 7. CONSULTA FINAL CORREGIDA');
    
    // Construir la consulta final
    let finalQuery = supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (userProviderPhones.length > 0) {
      // Usar múltiples consultas OR separadas
      const { data: finalResult } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .or(`user_id.eq.${testUserId},user_id.is.null,contact_id.in.(${userProviderPhones.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(20);
      
      const finalReceived = finalResult.filter(m => m.message_type === 'received').length;
      const finalSent = finalResult.filter(m => m.message_type === 'sent').length;
      
      console.log(`✅ Consulta final: ${finalResult.length} mensajes totales`);
      console.log(`📥 Mensajes recibidos: ${finalReceived}`);
      console.log(`📤 Mensajes enviados: ${finalSent}`);
      
      if (finalReceived > 0) {
        console.log('🎉 ¡ÉXITO! Los mensajes recibidos están siendo incluidos');
      } else {
        console.log('⚠️ Aún no se incluyen mensajes recibidos');
      }
    }
    
  } catch (error) {
    console.error('❌ Error en investigación:', error);
  }
}

investigarConsultaOR();
