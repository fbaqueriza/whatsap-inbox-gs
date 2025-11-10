const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMissingColumns() {
  try {
    console.log('🔧 AGREGANDO COLUMNAS FALTANTES A whatsapp_configs');
    console.log('='.repeat(60));

    // Lista de columnas que necesitamos agregar
    const columnsToAdd = [
      {
        name: 'is_active',
        definition: 'BOOLEAN DEFAULT true'
      },
      {
        name: 'is_sandbox', 
        definition: 'BOOLEAN DEFAULT false'
      },
      {
        name: 'kapso_config_id',
        definition: 'VARCHAR(100)'
      },
      {
        name: 'meta_phone_number_id',
        definition: 'VARCHAR(100)'
      },
      {
        name: 'meta_access_token',
        definition: 'TEXT'
      },
      {
        name: 'webhook_url',
        definition: 'TEXT'
      },
      {
        name: 'created_at',
        definition: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      },
      {
        name: 'updated_at',
        definition: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      }
    ];

    console.log('\n📋 INSTRUCCIONES PARA AGREGAR COLUMNAS:');
    console.log('1. Ve a tu panel de Supabase (https://supabase.com/dashboard)');
    console.log('2. Navega a SQL Editor');
    console.log('3. Ejecuta los siguientes comandos ALTER TABLE:');
    console.log('');

    for (const column of columnsToAdd) {
      console.log(`ALTER TABLE whatsapp_configs ADD COLUMN IF NOT EXISTS ${column.name} ${column.definition};`);
    }

    console.log('');
    console.log('4. Después de agregar las columnas, ejecuta:');
    console.log('');
    console.log('-- Crear índices');
    console.log('CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);');
    console.log('CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);');
    console.log('CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);');
    console.log('CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;');
    console.log('');
    console.log('-- Habilitar RLS');
    console.log('ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;');
    console.log('');
    console.log('-- Crear política RLS');
    console.log('CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs');
    console.log('  FOR ALL USING (auth.uid() = user_id);');
    console.log('');
    console.log('5. Una vez completado, ejecuta este script nuevamente para verificar');

    // Intentar verificar si las columnas ya existen
    console.log('\n🔍 Verificando columnas existentes...');
    const { data: testData, error: testError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .limit(1);

    if (testError) {
      console.log('❌ Error verificando columnas:', testError.message);
    } else {
      console.log('✅ Columnas actuales:', Object.keys(testData?.[0] || {}));
    }

    return false; // Indica que necesita intervención manual

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  addMissingColumns()
    .then(() => {
      console.log('\nℹ️  Sigue las instrucciones para agregar las columnas faltantes');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { addMissingColumns };
