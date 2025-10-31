-- Verificar y corregir permisos de la tabla user_whatsapp_config

-- 1. Verificar si RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_whatsapp_config';

-- 2. Habilitar RLS si no está habilitado
ALTER TABLE user_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users can view own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can insert own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can update own whatsapp config" ON user_whatsapp_config;

-- 4. Crear políticas RLS
CREATE POLICY "Users can view own whatsapp config" ON user_whatsapp_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp config" ON user_whatsapp_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp config" ON user_whatsapp_config
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Verificar que las políticas se crearon
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_whatsapp_config';

-- 6. Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'user_whatsapp_config';
