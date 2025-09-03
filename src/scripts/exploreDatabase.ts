import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function exploreDatabase() {
  console.log('🔍 EXPLORANDO BASE DE DATOS SUPABASE...\n');

  try {
    // 1. OBTENER LISTA DE TABLAS
    console.log('📋 TABLAS DISPONIBLES:');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (tablesError) {
      console.error('❌ Error obteniendo tablas:', tablesError);
      return;
    }

    console.log('Tablas encontradas:');
    tables?.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    // 2. EXPLORAR ESTRUCTURA DE TABLAS RELEVANTES
    const relevantTables = ['invoices', 'providers', 'orders', 'payments', 'documents'];
    
    for (const tableName of relevantTables) {
      if (tables?.some(t => t.table_name === tableName)) {
        console.log(`\n🔍 ESTRUCTURA DE LA TABLA: ${tableName}`);
        
        // Obtener columnas
        const { data: columns, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position');

        if (columnsError) {
          console.error(`❌ Error obteniendo columnas de ${tableName}:`, columnsError);
          continue;
        }

        console.log('Columnas:');
        columns?.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultValue = col.column_default ? ` = ${col.column_default}` : '';
          console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultValue}`);
        });

        // Obtener claves primarias
        const { data: primaryKeys, error: pkError } = await supabase
          .from('information_schema.key_column_usage')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .eq('constraint_name', `${tableName}_pkey`);

        if (!pkError && primaryKeys && primaryKeys.length > 0) {
          console.log('Clave primaria:', primaryKeys.map(pk => pk.column_name).join(', '));
        }

        // Obtener claves foráneas
        const { data: foreignKeys, error: fkError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            column_name,
            constraint_name,
            referenced_table_name,
            referenced_column_name
          `)
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .not('constraint_name', 'like', '%_pkey');

        if (!fkError && foreignKeys && foreignKeys.length > 0) {
          console.log('Claves foráneas:');
          foreignKeys.forEach(fk => {
            console.log(`  - ${fk.column_name} → ${fk.referenced_table_name}.${fk.referenced_column_name}`);
          });
        }

        // Obtener índices
        const { data: indexes, error: idxError } = await supabase
          .from('pg_indexes')
          .select('indexname, indexdef')
          .eq('tablename', tableName);

        if (!idxError && indexes && indexes.length > 0) {
          console.log('Índices:');
          indexes.forEach(idx => {
            console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
          });
        }
      }
    }

    // 3. EXPLORAR DATOS DE EJEMPLO
    console.log('\n📊 DATOS DE EJEMPLO:');
    for (const tableName of relevantTables) {
      if (tables?.some(t => t.table_name === tableName)) {
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(3);

        if (!sampleError && sampleData && sampleData.length > 0) {
          console.log(`\n${tableName} (${sampleData.length} registros):`);
          sampleData.forEach((record, index) => {
            console.log(`  ${index + 1}. ${JSON.stringify(record, null, 2)}`);
          });
        }
      }
    }

    // 4. VERIFICAR RELACIONES
    console.log('\n🔗 RELACIONES ENTRE TABLAS:');
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select(`
        constraint_name,
        table_name,
        constraint_type
      `)
      .eq('table_schema', 'public')
      .in('constraint_type', ['FOREIGN KEY', 'PRIMARY KEY']);

    if (!constraintsError && constraints) {
      constraints.forEach(constraint => {
        console.log(`  - ${constraint.table_name}: ${constraint.constraint_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar exploración
exploreDatabase().then(() => {
  console.log('\n✅ EXPLORACIÓN COMPLETADA');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
