const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllTables() {
  try {
    console.log('🔍 Consultando TODAS las tablas en Supabase...\n');
    
    // Intentar obtener las tablas usando SQL directo
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `
    });
    
    if (error) {
      console.log('⚠️  No se puede usar exec_sql, usando método manual...\n');
      
      // Lista exhaustiva de posibles tablas
      const allPossibleTables = [
        // WhatsApp
        'whatsapp_configs',
        'whatsapp_messages',
        'whatsapp_templates',
        'whatsapp_webhooks',
        
        // Ordenes y negocios
        'orders',
        'order_items',
        'order_status_history',
        
        // Usuarios y proveedores
        'users',
        'user_profiles',
        'providers',
        'provider_contacts',
        
        // Productos e inventario
        'products',
        'stock',
        'stock_movements',
        'categories',
        
        // Chat y mensajería
        'chat_messages',
        'conversations',
        'message_attachments',
        
        // Facturas y pagos
        'invoices',
        'invoice_items',
        'payments',
        'payment_receipts',
        
        // Otros
        'notifications',
        'audit_logs',
        'settings',
        'api_keys',
        'integrations'
      ];
      
      console.log('📋 Probando tablas conocidas del proyecto:\n');
      const existingTables = [];
      const missingTables = [];
      
      for (const table of allPossibleTables) {
        const { error: testError } = await supabase
          .from(table)
          .select('*')
          .limit(0);
        
        if (!testError) {
          console.log(`✅ ${table}`);
          existingTables.push(table);
        } else if (testError.code === '42P01') {
          console.log(`❌ ${table}`);
          missingTables.push(table);
        } else {
          console.log(`⚠️  ${table} - Error: ${testError.message}`);
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log(`📊 RESUMEN:`);
      console.log(`✅ Tablas que existen: ${existingTables.length}`);
      console.log(`❌ Tablas que NO existen: ${missingTables.length}`);
      console.log('\n📋 Tablas existentes:');
      existingTables.forEach(t => console.log(`  - ${t}`));
      
      if (missingTables.length > 0) {
        console.log('\n📋 Tablas faltantes:');
        missingTables.forEach(t => console.log(`  - ${t}`));
      }
      
    } else {
      console.log('✅ Tablas encontradas en la base de datos:');
      if (data && data.length > 0) {
        data.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
        console.log(`\n📊 Total: ${data.length} tablas`);
      } else {
        console.log('⚠️  No se encontraron tablas');
      }
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
}

// Ejecutar
if (require.main === module) {
  listAllTables()
    .then(() => {
      console.log('\n✅ Consulta completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error.message);
      process.exit(1);
    });
}

module.exports = { listAllTables };

