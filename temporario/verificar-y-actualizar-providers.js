require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar service role key para modificaciones

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno de Supabase no encontradas');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarYActualizarProviders() {
  console.log('🔍 Verificando y actualizando estructura de tabla providers...\n');

  try {
    // 1. Verificar la estructura actual de la tabla providers
    console.log('1️⃣ Verificando estructura actual de la tabla providers...');
    
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'providers' });

    if (columnsError) {
      console.log('⚠️ No se pudo obtener columnas con RPC, usando query directo...');
      
      // Query alternativo para obtener información de columnas
      const { data: tableInfo, error: tableError } = await supabase
        .from('providers')
        .select('*')
        .limit(0);
      
      if (tableError) {
        console.error('❌ Error accediendo a la tabla providers:', tableError);
        return;
      }
      
      console.log('✅ Tabla providers accesible');
    } else {
      console.log('📋 Columnas encontradas:', columns);
    }

    // 2. Verificar si existe el campo default_delivery_time
    console.log('\n2️⃣ Verificando si existe el campo default_delivery_time...');
    
    try {
      const { data: testQuery, error: testError } = await supabase
        .from('providers')
        .select('id, name, default_delivery_time')
        .limit(1);
      
      if (testError) {
        if (testError.message.includes('default_delivery_time')) {
          console.log('❌ Campo default_delivery_time NO existe');
          console.log('   Error:', testError.message);
          
          // 3. Agregar el campo si no existe
          console.log('\n3️⃣ Agregando campo default_delivery_time...');
          
          const { error: alterError } = await supabase
            .rpc('add_column_if_not_exists', {
              table_name: 'providers',
              column_name: 'default_delivery_time',
              column_type: 'text[]',
              default_value: '{}'
            });
          
          if (alterError) {
            console.log('⚠️ No se pudo usar RPC, intentando con SQL directo...');
            
            // Intentar con SQL directo
            const { error: sqlError } = await supabase
              .rpc('exec_sql', {
                sql_query: `
                  ALTER TABLE providers 
                  ADD COLUMN IF NOT EXISTS default_delivery_time TEXT[] DEFAULT '{}'
                `
              });
            
            if (sqlError) {
              console.error('❌ No se pudo agregar la columna:', sqlError);
              console.log('\n💡 SOLUCIÓN MANUAL:');
              console.log('   Ejecuta el script SQL en Supabase SQL Editor:');
              console.log('   temporario/verificar-estructura-providers.sql');
              return;
            }
          }
          
          console.log('✅ Campo default_delivery_time agregado exitosamente');
        } else {
          console.error('❌ Error inesperado:', testError);
          return;
        }
      } else {
        console.log('✅ Campo default_delivery_time ya existe');
      }
    } catch (error) {
      console.error('❌ Error verificando campo:', error);
      return;
    }

    // 4. Verificar que el campo funciona correctamente
    console.log('\n4️⃣ Verificando funcionalidad del campo...');
    
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('id, name, default_delivery_time')
      .limit(5);
    
    if (providersError) {
      console.error('❌ Error consultando providers:', providersError);
      return;
    }
    
    console.log('📋 Proveedores encontrados:');
    providers.forEach(provider => {
      const timeCount = provider.default_delivery_time ? provider.default_delivery_time.length : 0;
      console.log(`   - ${provider.name}: ${timeCount} horarios configurados`);
    });

    // 5. Actualizar proveedores existentes con horarios de ejemplo
    console.log('\n5️⃣ Actualizando proveedores con horarios de ejemplo...');
    
    const { data: updatedProviders, error: updateError } = await supabase
      .from('providers')
      .update({ 
        default_delivery_time: ['08:00', '14:00', '16:00'] 
      })
      .eq('name', "L'igiene")
      .select('id, name, default_delivery_time');
    
    if (updateError) {
      console.log('⚠️ No se pudo actualizar L\'igiene:', updateError.message);
    } else if (updatedProviders && updatedProviders.length > 0) {
      console.log('✅ L\'igiene actualizado con horarios:', updatedProviders[0].default_delivery_time);
    }

    // 6. Verificar datos finales
    console.log('\n6️⃣ Verificando datos finales...');
    
    const { data: finalProviders, error: finalError } = await supabase
      .from('providers')
      .select('id, name, phone, default_delivery_time')
      .order('name');
    
    if (finalError) {
      console.error('❌ Error en consulta final:', finalError);
      return;
    }
    
    console.log('\n📊 Estado final de la tabla providers:');
    finalProviders.forEach(provider => {
      const timeCount = provider.default_delivery_time ? provider.default_delivery_time.length : 0;
      const times = provider.default_delivery_time ? provider.default_delivery_time.join(', ') : 'Sin configurar';
      console.log(`   - ${provider.name}: ${timeCount} horarios [${times}]`);
    });

    console.log('\n🎉 Verificación y actualización completada!');
    console.log('\n💡 Próximos pasos:');
    console.log('   1. Verifica que los horarios aparezcan en el frontend');
    console.log('   2. Crea una nueva orden para probar los horarios');
    console.log('   3. Verifica que se envíen en el mensaje WhatsApp');
    
  } catch (error) {
    console.error('❌ Error general:', error);
    console.log('\n💡 SOLUCIÓN MANUAL:');
    console.log('   Ejecuta el script SQL en Supabase SQL Editor:');
    console.log('   temporario/verificar-estructura-providers.sql');
  }
}

verificarYActualizarProviders();
