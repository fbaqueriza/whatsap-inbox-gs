const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  try {
    console.log('🚀 Creando tabla whatsapp_configs...');
    
    // Intentar insertar un registro de prueba para ver si la tabla existe
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
      const errorMsg = insertError.message || String(insertError);
      if (errorMsg.includes('does not exist') || insertError.code === '42P01') {
        console.log('❌ La tabla whatsapp_configs no existe');
        console.log('📋 Necesitas crear la tabla en Supabase Dashboard:');
        console.log('');
        console.log('1. Ve a https://supabase.com/dashboard/project/jyalmdhyuftjldewbfzw/editor');
        console.log('2. Clic en "SQL Editor"');
        console.log('3. Ejecuta este SQL:');
        console.log('');
        console.log(`
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

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;

ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own whatsapp configs" ON whatsapp_configs;
CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs
  FOR ALL USING (auth.uid() = user_id);
        `);
        console.log('');
        console.log('❌ Error completo:', JSON.stringify(insertError, null, 2));
        return false;
      } else {
        console.log('❌ Error insertando registro:', errorMsg);
        console.log('❌ Error completo:', JSON.stringify(insertError, null, 2));
        return false;
      }
    } else {
      console.log('✅ La tabla existe y funciona correctamente');
      
      // Limpiar el registro de prueba
      if (insertData?.[0]?.id) {
        await supabase
          .from('whatsapp_configs')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Registro de prueba eliminado');
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar
if (require.main === module) {
  createTable()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { createTable };

