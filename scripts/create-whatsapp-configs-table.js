const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createWhatsAppConfigsTable() {
  try {
    console.log('🚀 Creando tabla whatsapp_configs...');

    // SQL para crear la tabla
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS whatsapp_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        kapso_config_id VARCHAR(100),
        meta_phone_number_id VARCHAR(100),
        meta_access_token TEXT,
        is_sandbox BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        webhook_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Ejecutar SQL usando rpc
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      console.error('❌ Error creando tabla:', error);
      return false;
    }

    console.log('✅ Tabla whatsapp_configs creada exitosamente');

    // Crear índices
    console.log('🚀 Creando índices...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);',
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);',
      'CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;'
    ];

    for (const indexSQL of indexes) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (indexError) {
        console.error('❌ Error creando índice:', indexError);
      } else {
        console.log('✅ Índice creado');
      }
    }

    // Habilitar RLS
    console.log('🚀 Configurando RLS...');
    const rlsSQL = 'ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;';
    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: rlsSQL });
    
    if (rlsError) {
      console.error('❌ Error habilitando RLS:', rlsError);
    } else {
      console.log('✅ RLS habilitado');
    }

    // Crear política RLS
    console.log('🚀 Creando política RLS...');
    const policySQL = `
      CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs
      FOR ALL USING (auth.uid() = user_id);
    `;
    const { error: policyError } = await supabase.rpc('exec_sql', { sql: policySQL });
    
    if (policyError) {
      console.error('❌ Error creando política:', policyError);
    } else {
      console.log('✅ Política RLS creada');
    }

    console.log('🎉 ¡Tabla whatsapp_configs configurada completamente!');
    return true;

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createWhatsAppConfigsTable()
    .then(success => {
      if (success) {
        console.log('✅ Script completado exitosamente');
        process.exit(0);
      } else {
        console.log('❌ Script falló');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { createWhatsAppConfigsTable };
