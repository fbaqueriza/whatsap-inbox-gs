-- =====================================================
-- VERIFICACIÓN Y CORRECCIÓN DE POLÍTICAS RLS
-- =====================================================

-- 1. Verificar si RLS está habilitado
SELECT relrowsecurity FROM pg_class WHERE relname = 'user_whatsapp_config';

-- 2. Verificar políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_whatsapp_config';

-- 3. Si no hay políticas o están mal configuradas, ejecutar esto:
-- Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users can view own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can insert own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can update own whatsapp config" ON user_whatsapp_config;
DROP POLICY IF EXISTS "Users can delete own whatsapp config" ON user_whatsapp_config;

-- Crear políticas RLS correctas
CREATE POLICY "Users can view own whatsapp config" ON user_whatsapp_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp config" ON user_whatsapp_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp config" ON user_whatsapp_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp config" ON user_whatsapp_config
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_whatsapp_config';
