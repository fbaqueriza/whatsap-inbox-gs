const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixTableStructure() {
  try {
    console.log('🔧 CORRIGIENDO ESTRUCTURA DE TABLA whatsapp_configs');
    console.log('='.repeat(60));

    // 1. Verificar estructura actual
    console.log('\n1️⃣ Verificando estructura actual...');
    const { data: currentStructure, error: structureError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .limit(1);

    if (structureError) {
      console.log('❌ Error obteniendo estructura:', structureError.message);
      
      if (structureError.code === '42703') {
        console.log('\n🔧 La tabla existe pero tiene estructura incorrecta');
        console.log('📋 INSTRUCCIONES PARA CORREGIR:');
        console.log('');
        console.log('1. Ve a tu panel de Supabase (https://supabase.com/dashboard)');
        console.log('2. Navega a Table Editor');
        console.log('3. Busca la tabla "whatsapp_configs"');
        console.log('4. Elimina la tabla actual (si está vacía)');
        console.log('5. Ve a SQL Editor y ejecuta:');
        console.log('');
        console.log('-- Eliminar tabla si existe');
        console.log('DROP TABLE IF EXISTS whatsapp_configs;');
        console.log('');
        console.log('-- Crear tabla con estructura correcta');
        console.log('CREATE TABLE whatsapp_configs (');
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
        console.log('CREATE INDEX idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);');
        console.log('CREATE INDEX idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);');
        console.log('CREATE INDEX idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);');
        console.log('CREATE INDEX idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;');
        console.log('');
        console.log('-- Habilitar RLS');
        console.log('ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;');
        console.log('');
        console.log('-- Crear política RLS');
        console.log('CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs');
        console.log('  FOR ALL USING (auth.uid() = user_id);');
        console.log('');
        console.log('6. Una vez corregida, ejecuta este script nuevamente');
        return false;
      }
    } else {
      console.log('✅ Estructura actual:');
      if (currentStructure?.length > 0) {
        console.log('   - Campos:', Object.keys(currentStructure[0]));
      } else {
        console.log('   - Tabla vacía');
      }
    }

    // 2. Verificar que los campos necesarios existen
    console.log('\n2️⃣ Verificando campos necesarios...');
    const requiredFields = ['id', 'user_id', 'phone_number', 'kapso_config_id', 'is_sandbox', 'is_active'];
    
    if (currentStructure?.length > 0) {
      const existingFields = Object.keys(currentStructure[0]);
      const missingFields = requiredFields.filter(field => !existingFields.includes(field));
      
      if (missingFields.length > 0) {
        console.log('❌ Campos faltantes:', missingFields);
        return false;
      } else {
        console.log('✅ Todos los campos necesarios están presentes');
      }
    }

    console.log('\n🎉 ESTRUCTURA DE TABLA VERIFICADA');
    return true;

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixTableStructure()
    .then(success => {
      if (success) {
        console.log('\n✅ Verificación completada exitosamente');
        process.exit(0);
      } else {
        console.log('\nℹ️  Sigue las instrucciones para corregir la tabla');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { fixTableStructure };
