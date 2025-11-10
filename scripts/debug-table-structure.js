const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugTableStructure() {
  try {
    console.log('🔍 DEBUGGING ESTRUCTURA DE TABLA whatsapp_configs');
    console.log('='.repeat(60));

    // 1. Intentar insertar un registro de prueba para ver qué campos acepta
    console.log('\n1️⃣ Intentando insertar registro de prueba...');
    
    const testRecord = {
      user_id: '00000000-0000-0000-0000-000000000000', // UUID de prueba
      phone_number: '+1234567890',
      kapso_config_id: 'test_config_123',
      is_sandbox: true,
      is_active: true,
      webhook_url: 'https://example.com/webhook'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('whatsapp_configs')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.log('❌ Error insertando registro:', insertError.message);
      console.log('   - Código:', insertError.code);
      console.log('   - Detalles:', insertError.details);
      console.log('   - Hint:', insertError.hint);
      
      if (insertError.code === '42703') {
        console.log('\n🔧 DIAGNÓSTICO: La columna user_id no existe');
        console.log('📋 SOLUCIÓN:');
        console.log('1. Ve a Supabase Dashboard > Table Editor');
        console.log('2. Busca la tabla whatsapp_configs');
        console.log('3. Verifica las columnas existentes');
        console.log('4. Si falta user_id, elimina la tabla y créala nuevamente con el SQL correcto');
      }
    } else {
      console.log('✅ Registro insertado exitosamente:', insertData);
      
      // Limpiar el registro de prueba
      if (insertData?.[0]?.id) {
        await supabase
          .from('whatsapp_configs')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Registro de prueba eliminado');
      }
    }

    // 2. Intentar obtener información de la tabla usando información_schema
    console.log('\n2️⃣ Consultando información de la tabla...');
    try {
      const { data: tableInfo, error: tableInfoError } = await supabase
        .rpc('get_table_columns', { table_name: 'whatsapp_configs' });
      
      if (tableInfoError) {
        console.log('⚠️  No se pudo obtener información de la tabla:', tableInfoError.message);
      } else {
        console.log('✅ Información de la tabla:', tableInfo);
      }
    } catch (error) {
      console.log('⚠️  Función get_table_columns no disponible');
    }

    // 3. Intentar hacer una consulta SELECT * para ver qué devuelve
    console.log('\n3️⃣ Probando consulta SELECT...');
    const { data: selectData, error: selectError } = await supabase
      .from('whatsapp_configs')
      .select('*');

    if (selectError) {
      console.log('❌ Error en SELECT:', selectError.message);
      console.log('   - Código:', selectError.code);
    } else {
      console.log('✅ SELECT exitoso, registros:', selectData?.length || 0);
    }

    console.log('\n📋 RESUMEN:');
    console.log('- Tabla existe:', !selectError || selectError.code !== 'PGRST116');
    console.log('- Estructura correcta:', !insertError || insertError.code !== '42703');
    
    if (insertError?.code === '42703') {
      console.log('\n🔧 ACCIÓN REQUERIDA:');
      console.log('La tabla whatsapp_configs existe pero tiene estructura incorrecta.');
      console.log('Necesitas recrearla con la estructura correcta en Supabase Dashboard.');
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  debugTableStructure()
    .then(() => {
      console.log('\n✅ Debug completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando debug:', error);
      process.exit(1);
    });
}

module.exports = { debugTableStructure };
