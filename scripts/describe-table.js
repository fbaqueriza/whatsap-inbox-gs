const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function describeTable(tableName) {
  try {
    console.log(`🔍 Describiendo tabla: ${tableName}\n`);
    
    // Intentar obtener algunos registros para inferir la estructura
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Columnas detectadas (basado en el primer registro):');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        console.log(`  - ${col}: ${typeof data[0][col]}`);
      });
      
      console.log('\n📄 Registros de ejemplo:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('⚠️  La tabla está vacía');
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
}

// Leer la tabla desde argumentos
const tableName = process.argv[2];

if (!tableName) {
  console.log('❌ Uso: node scripts/describe-table.js <nombre_tabla>');
  console.log('Ejemplo: node scripts/describe-table.js whatsapp_messages');
  process.exit(1);
}

describeTable(tableName)
  .then(() => {
    console.log('\n✅ Descripción completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error ejecutando script:', error.message);
    process.exit(1);
  });

module.exports = { describeTable };

