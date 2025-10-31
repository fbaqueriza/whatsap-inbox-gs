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

async function checkAndCreateTable() {
  try {
    console.log('🔍 Verificando si la tabla whatsapp_configs existe...');

    // Intentar hacer una consulta simple para ver si la tabla existe
    const { data, error } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📋 La tabla whatsapp_configs no existe, necesitamos crearla manualmente');
        console.log('');
        console.log('🔧 INSTRUCCIONES:');
        console.log('1. Ve a tu panel de Supabase (https://supabase.com/dashboard)');
        console.log('2. Navega a SQL Editor');
        console.log('3. Ejecuta el siguiente SQL:');
        console.log('');
        console.log('-- Crear tabla whatsapp_configs');
        console.log('CREATE TABLE IF NOT EXISTS whatsapp_configs (');
        console.log('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('  user_id UUID NOT NULL,');
        console.log('  phone_number VARCHAR(20) NOT NULL,');
        console.log('  kapso_config_id VARCHAR(100),');
        console.log('  meta_phone_number_id VARCHAR(100),');
        console.log('  meta_access_token TEXT,');
        console.log('  is_sandbox BOOLEAN DEFAULT false,');
        console.log('  is_active BOOLEAN DEFAULT true,');
        console.log('  webhook_url TEXT,');
        console.log('  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
        console.log('  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
        console.log(');');
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
        console.log('4. Una vez creada, ejecuta este script nuevamente para verificar');
        return false;
      } else {
        console.error('❌ Error verificando tabla:', error);
        return false;
      }
    } else {
      console.log('✅ La tabla whatsapp_configs ya existe');
      console.log('📊 Registros encontrados:', data?.length || 0);
      return true;
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkAndCreateTable()
    .then(success => {
      if (success) {
        console.log('✅ Verificación completada exitosamente');
        process.exit(0);
      } else {
        console.log('ℹ️  Sigue las instrucciones para crear la tabla');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { checkAndCreateTable };
