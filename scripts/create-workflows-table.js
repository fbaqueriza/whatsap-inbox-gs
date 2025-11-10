const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function createWorkflowsTable() {
  try {
    console.log('🔧 [CreateWorkflowsTable] Iniciando creación de tabla workflows...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Leer el archivo SQL
    const sql = fs.readFileSync('create-workflows-table.sql', 'utf8');
    console.log('📄 [CreateWorkflowsTable] SQL leído correctamente');

    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ [CreateWorkflowsTable] Error ejecutando SQL:', error);
      return;
    }

    console.log('✅ [CreateWorkflowsTable] Tabla workflows creada exitosamente');
    console.log('📊 [CreateWorkflowsTable] Resultado:', data);

  } catch (error) {
    console.error('❌ [CreateWorkflowsTable] Error general:', error);
  }
}

createWorkflowsTable();
