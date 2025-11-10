const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  try {
    console.log('🔍 Consultando tablas en Supabase...\n');
    
    // Intentar obtener las tablas usando información del esquema
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (error) {
      console.log('❌ Error consultando información del esquema:', error.message);
      console.log('🔍 Intentando método alternativo...\n');
      
      // Método alternativo: intentar leer de tablas conocidas
      const knownTables = [
        'whatsapp_configs',
        'whatsapp_messages',
        'orders',
        'users',
        'providers',
        'products',
        'stock',
        'chat_messages',
        'conversations'
      ];
      
      console.log('📋 Probando tablas conocidas:');
      for (const table of knownTables) {
        const { error: testError } = await supabase
          .from(table)
          .select('*')
          .limit(0);
        
        if (!testError) {
          console.log(`✅ ${table} - Existe`);
        } else if (testError.code === '42P01') {
          console.log(`❌ ${table} - No existe`);
        } else {
          console.log(`⚠️  ${table} - ${testError.message}`);
        }
      }
    } else {
      console.log('✅ Tablas encontradas:');
      data.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }
    
    // Verificar específicamente whatsapp_configs
    console.log('\n🔍 Verificando tabla whatsapp_configs específicamente...');
    const { error: wsError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .limit(1);
    
    if (wsError) {
      if (wsError.code === '42P01') {
        console.log('❌ whatsapp_configs NO EXISTE');
      } else {
        console.log('⚠️  Error:', wsError.message);
      }
    } else {
      console.log('✅ whatsapp_configs existe');
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

// Ejecutar
if (require.main === module) {
  listTables()
    .then(() => {
      console.log('\n✅ Consulta completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { listTables };

