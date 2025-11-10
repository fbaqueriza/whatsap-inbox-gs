const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMessagesTable() {
  console.log('🗄️ Creando tabla de mensajes...');
  
  try {
    // Leer el archivo SQL
    const sqlContent = fs.readFileSync('create-messages-table.sql', 'utf8');
    
    console.log('📝 Ejecutando SQL...');
    
    // Ejecutar el SQL usando la función rpc o directamente
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.log('❌ Error ejecutando SQL:', error);
      
      // Si no existe la función exec_sql, intentar crear la tabla directamente
      console.log('🔄 Intentando crear tabla directamente...');
      
      const { error: createError } = await supabase
        .from('messages')
        .select('id')
        .limit(1);
      
      if (createError && createError.code === '42P01') {
        console.log('📝 La tabla messages no existe, necesitas crearla manualmente en Supabase');
        console.log('💡 Ve a Supabase Dashboard > SQL Editor y ejecuta el contenido de create-messages-table.sql');
        console.log('\n📋 SQL a ejecutar:');
        console.log(sqlContent);
      } else {
        console.log('✅ La tabla messages ya existe');
      }
    } else {
      console.log('✅ Tabla creada exitosamente:', data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createMessagesTable();
