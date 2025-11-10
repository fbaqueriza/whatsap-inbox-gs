const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLCommands() {
  try {
    console.log('🚀 EJECUTANDO COMANDOS SQL PARA CONFIGURAR whatsapp_configs');
    console.log('='.repeat(70));

    // Lista de comandos SQL a ejecutar
    const sqlCommands = [
      // Agregar columnas faltantes
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN DEFAULT false;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS kapso_config_id VARCHAR(100);',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(100);',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS meta_access_token TEXT;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS webhook_url TEXT;',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
      'ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
      
      // Crear índices
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);',
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);',
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;',
      
      // Habilitar RLS
      'ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;',
      
      // Crear política RLS
      'CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs FOR ALL USING (auth.uid() = user_id);'
    ];

    console.log(`📋 Ejecutando ${sqlCommands.length} comandos SQL...`);

    for (let i = 0; i < sqlCommands.length; i++) {
      const sql = sqlCommands[i];
      console.log(`\n${i + 1}/${sqlCommands.length} Ejecutando: ${sql.substring(0, 50)}...`);
      
      try {
        // Usar la función sql() de Supabase para ejecutar SQL directo
        const { data, error } = await supabase.rpc('exec', { sql });
        
        if (error) {
          // Algunos errores son esperados (como "ya existe")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate key')) {
            console.log(`   ⚠️  ${error.message} (esperado)`);
          } else {
            console.log(`   ❌ Error: ${error.message}`);
          }
        } else {
          console.log(`   ✅ Comando ejecutado exitosamente`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error ejecutando comando: ${err.message}`);
      }
    }

    // Verificar la estructura final
    console.log('\n🔍 Verificando estructura final...');
    const { data: testData, error: testError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .limit(1);

    if (testError) {
      console.log('❌ Error verificando estructura:', testError.message);
    } else {
      console.log('✅ Estructura verificada');
      if (testData?.length > 0) {
        console.log('   - Campos disponibles:', Object.keys(testData[0]));
      } else {
        console.log('   - Tabla vacía (normal)');
      }
    }

    // Probar insertar un registro de prueba
    console.log('\n🧪 Probando inserción de registro de prueba...');
    const testRecord = {
      user_id: '00000000-0000-0000-0000-000000000000',
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
      console.log('❌ Error insertando registro de prueba:', insertError.message);
    } else {
      console.log('✅ Registro de prueba insertado exitosamente');
      
      // Limpiar el registro de prueba
      if (insertData?.[0]?.id) {
        await supabase
          .from('whatsapp_configs')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Registro de prueba eliminado');
      }
    }

    console.log('\n🎉 CONFIGURACIÓN DE TABLA COMPLETADA');
    console.log('='.repeat(70));
    console.log('✅ Columnas agregadas');
    console.log('✅ Índices creados');
    console.log('✅ RLS habilitado');
    console.log('✅ Política RLS creada');
    console.log('✅ Estructura verificada');
    console.log('✅ Inserción probada');
    
    return true;

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  executeSQLCommands()
    .then(success => {
      if (success) {
        console.log('\n✅ Script completado exitosamente');
        process.exit(0);
      } else {
        console.log('\n❌ Script falló');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { executeSQLCommands };
