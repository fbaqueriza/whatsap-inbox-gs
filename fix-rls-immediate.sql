-- =====================================================
-- CORRECCIÓN INMEDIATA DE POLÍTICAS RLS - VERSIÓN SIMPLIFICADA
-- =====================================================

-- 1. Verificar si la tabla existe y tiene datos
SELECT COUNT(*) as total_records FROM user_whatsapp_config;

-- 2. Verificar RLS actual
SELECT relrowsecurity FROM pg_class WHERE relname = 'user_whatsapp_config';

-- 3. Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Users can view own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can insert own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can update own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can delete own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_whatsapp_config;

-- 4. Crear políticas RLS básicas y funcionales
CREATE POLICY "Enable read access for all users" ON user_whatsapp_config
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON user_whatsapp_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id" ON user_whatsapp_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on user_id" ON user_whatsapp_config
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Verificar que las políticas se crearon
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_whatsapp_config';

-- 6. Probar acceso directo
SELECT * FROM user_whatsapp_config LIMIT 1;
