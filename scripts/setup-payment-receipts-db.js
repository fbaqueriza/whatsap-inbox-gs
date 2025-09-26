const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno de Supabase no configuradas');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupPaymentReceiptsDatabase() {
  try {
    console.log('🚀 Iniciando configuración de base de datos para comprobantes de pago...');
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '..', 'docs', 'database-schema-payment-receipts.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Archivo SQL leído:', sqlPath);
    console.log('📊 Tamaño del archivo:', sqlContent.length, 'caracteres');
    
    // Ejecutar el SQL
    console.log('⚡ Ejecutando SQL en Supabase...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Error ejecutando SQL:', error);
      
      // Intentar ejecutar por partes si hay error
      console.log('🔄 Intentando ejecutar por partes...');
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        console.log(`📝 Ejecutando statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            console.error(`❌ Error en statement ${i + 1}:`, stmtError);
          } else {
            console.log(`✅ Statement ${i + 1} ejecutado exitosamente`);
          }
        } catch (err) {
          console.error(`❌ Error ejecutando statement ${i + 1}:`, err);
        }
      }
    } else {
      console.log('✅ SQL ejecutado exitosamente');
    }
    
    // Verificar que las tablas se crearon
    console.log('🔍 Verificando tablas creadas...');
    
    const tables = ['payment_receipts', 'payment_receipt_assignment_attempts', 'payment_receipt_notifications'];
    
    for (const table of tables) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (tableError) {
          console.error(`❌ Error verificando tabla ${table}:`, tableError);
        } else {
          console.log(`✅ Tabla ${table} verificada exitosamente`);
        }
      } catch (err) {
        console.error(`❌ Error verificando tabla ${table}:`, err);
      }
    }
    
    console.log('🎉 Configuración de base de datos completada!');
    console.log('');
    console.log('📋 Tablas creadas:');
    console.log('   • payment_receipts - Comprobantes de pago');
    console.log('   • payment_receipt_assignment_attempts - Intentos de asignación');
    console.log('   • payment_receipt_notifications - Notificaciones');
    console.log('');
    console.log('🔧 Funciones creadas:');
    console.log('   • update_payment_receipts_updated_at_column() - Trigger para updated_at');
    console.log('');
    console.log('🔒 Políticas RLS configuradas para seguridad');
    
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupPaymentReceiptsDatabase();
}

module.exports = { setupPaymentReceiptsDatabase };
