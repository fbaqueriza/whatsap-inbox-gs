require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function probarBusquedaProvider() {
  console.log('🔍 PROBANDO LÓGICA DE BÚSQUEDA DE PROVEEDORES\n');

  try {
    const contactId = '+5491135562673';
    
    console.log(`📱 Probando búsqueda para: ${contactId}`);
    
    // 1. Probar búsqueda original (sin +)
    console.log('\n🔍 1. BÚSQUEDA ORIGINAL (sin +)');
    const { data: providersOriginal, error: errorOriginal } = await supabase
      .from('providers')
      .select('user_id, phone')
      .eq('phone', contactId.replace('+', ''));
    
    if (errorOriginal) {
      console.error('❌ Error en búsqueda original:', errorOriginal);
    } else {
      console.log(`✅ Resultados originales: ${providersOriginal.length}`);
      providersOriginal.forEach((provider, i) => {
        console.log(`  ${i + 1}. phone: ${provider.phone}, user_id: ${provider.user_id}`);
      });
    }
    
    // 2. Probar búsqueda nueva (con OR)
    console.log('\n🔍 2. BÚSQUEDA NUEVA (con OR)');
    const { data: providersNuevo, error: errorNuevo } = await supabase
      .from('providers')
      .select('user_id, phone')
      .or(`phone.eq.${contactId},phone.eq.${contactId.replace('+', '')}`);
    
    if (errorNuevo) {
      console.error('❌ Error en búsqueda nueva:', errorNuevo);
    } else {
      console.log(`✅ Resultados nuevos: ${providersNuevo.length}`);
      providersNuevo.forEach((provider, i) => {
        console.log(`  ${i + 1}. phone: ${provider.phone}, user_id: ${provider.user_id}`);
      });
    }
    
    // 3. Probar búsqueda con LIKE
    console.log('\n🔍 3. BÚSQUEDA CON LIKE');
    const { data: providersLike, error: errorLike } = await supabase
      .from('providers')
      .select('user_id, phone')
      .or(`phone.like.${contactId},phone.like.${contactId.replace('+', '')}`);
    
    if (errorLike) {
      console.error('❌ Error en búsqueda LIKE:', errorLike);
    } else {
      console.log(`✅ Resultados LIKE: ${providersLike.length}`);
      providersLike.forEach((provider, i) => {
        console.log(`  ${i + 1}. phone: ${provider.phone}, user_id: ${provider.user_id}`);
      });
    }
    
    // 4. Probar búsqueda exacta con +
    console.log('\n🔍 4. BÚSQUEDA EXACTA CON +');
    const { data: providersExact, error: errorExact } = await supabase
      .from('providers')
      .select('user_id, phone')
      .eq('phone', contactId);
    
    if (errorExact) {
      console.error('❌ Error en búsqueda exacta:', errorExact);
    } else {
      console.log(`✅ Resultados exactos: ${providersExact.length}`);
      providersExact.forEach((provider, i) => {
        console.log(`  ${i + 1}. phone: ${provider.phone}, user_id: ${provider.user_id}`);
      });
    }
    
    // 5. Análisis
    console.log('\n🔍 5. ANÁLISIS');
    
    if (providersNuevo.length > 0) {
      console.log('✅ La búsqueda nueva funciona correctamente');
      console.log(`📱 Encontrado user_id: ${providersNuevo[0].user_id}`);
      
      // 6. Probar guardar mensaje manualmente
      console.log('\n💾 6. PROBANDO GUARDAR MENSAJE MANUALMENTE');
      
      const { error: saveError } = await supabase
        .from('whatsapp_messages')
        .insert([{
          content: 'Mensaje de prueba manual - ' + new Date().toLocaleString(),
          message_type: 'received',
          status: 'delivered',
          contact_id: contactId,
          user_id: providersNuevo[0].user_id,
          message_sid: `test_manual_${Date.now()}`,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);
      
      if (saveError) {
        console.error('❌ Error guardando mensaje manual:', saveError);
      } else {
        console.log('✅ Mensaje guardado manualmente correctamente');
      }
      
    } else {
      console.log('❌ La búsqueda nueva no encuentra el proveedor');
      console.log('💡 Posibles problemas:');
      console.log('   - El número no está en la BD');
      console.log('   - El formato del número es diferente');
      console.log('   - Hay un problema con la consulta SQL');
    }
    
    // 7. Verificar todos los proveedores
    console.log('\n📋 7. TODOS LOS PROVEEDORES EN LA BD');
    const { data: todosProviders, error: errorTodos } = await supabase
      .from('providers')
      .select('user_id, phone, name')
      .order('phone');
    
    if (errorTodos) {
      console.error('❌ Error obteniendo todos los proveedores:', errorTodos);
    } else {
      console.log(`✅ Total de proveedores: ${todosProviders.length}`);
      todosProviders.forEach((provider, i) => {
        console.log(`  ${i + 1}. phone: ${provider.phone}, name: ${provider.name}, user_id: ${provider.user_id}`);
      });
    }

  } catch (error) {
    console.error('❌ Error en prueba:', error);
  }
}

probarBusquedaProvider();
