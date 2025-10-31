const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno faltantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recreateTableCompletely() {
  try {
    console.log('🔄 RECREANDO TABLA whatsapp_configs COMPLETAMENTE');
    console.log('='.repeat(60));

    // 1. Verificar si la tabla actual tiene datos
    console.log('\n1️⃣ Verificando tabla actual...');
    const { data: currentData, error: currentError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .limit(1);

    if (currentError) {
      console.log('❌ Error accediendo a tabla actual:', currentError.message);
    } else {
      console.log('✅ Tabla actual accesible, registros:', currentData?.length || 0);
    }

    // 2. Intentar insertar un registro con la estructura que necesitamos
    console.log('\n2️⃣ Probando inserción con estructura completa...');
    
    const testRecord = {
      user_id: '00000000-0000-0000-0000-000000000000',
      phone_number: '+1234567890',
      kapso_config_id: 'test_config_123',
      is_sandbox: true,
      is_active: true,
      webhook_url: 'https://example.com/webhook',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('whatsapp_configs')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.log('❌ Error insertando registro completo:', insertError.message);
      
      if (insertError.message.includes('is_active')) {
        console.log('\n🔧 DIAGNÓSTICO: La columna is_active no existe');
        console.log('📋 SOLUCIÓN ALTERNATIVA:');
        console.log('');
        console.log('Como no puedo ejecutar SQL directamente, vamos a usar un enfoque diferente:');
        console.log('1. Voy a crear un script que use la API de Supabase para crear la tabla');
        console.log('2. O podemos usar el panel web de Supabase');
        console.log('');
        console.log('💡 OPCIÓN RECOMENDADA:');
        console.log('Ve a https://supabase.com/dashboard > SQL Editor');
        console.log('Ejecuta este SQL:');
        console.log('');
        console.log('-- Eliminar tabla si existe');
        console.log('DROP TABLE IF EXISTS whatsapp_configs CASCADE;');
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
        console.log('3. Una vez ejecutado, vuelve aquí para continuar con las pruebas');
        
        return false;
      }
    } else {
      console.log('✅ Registro insertado exitosamente:', insertData);
      
      // Limpiar el registro de prueba
      if (insertData?.[0]?.id) {
        await supabase
          .from('whatsapp_configs')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Registro de prueba eliminado');
      }
      
      console.log('\n🎉 ¡LA TABLA YA TIENE LA ESTRUCTURA CORRECTA!');
      console.log('✅ Todas las columnas necesarias están presentes');
      console.log('✅ La inserción funciona correctamente');
      return true;
    }

    return false;

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return false;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  recreateTableCompletely()
    .then(success => {
      if (success) {
        console.log('\n✅ Verificación completada exitosamente');
        process.exit(0);
      } else {
        console.log('\nℹ️  Sigue las instrucciones para recrear la tabla');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { recreateTableCompletely };
