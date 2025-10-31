-- ============================================
-- 🧪 SCRIPT DE PRUEBA PARA WHATSAPP_CONFIGS
-- ============================================

-- 1. Verificar que la tabla existe
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_configs'
ORDER BY ordinal_position;

-- 2. Verificar índices
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'whatsapp_configs';

-- 3. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'whatsapp_configs';

-- 4. Insertar datos de prueba (solo si hay usuarios en auth.users)
-- INSERT INTO whatsapp_configs (user_id, phone_number, is_sandbox, is_active)
-- SELECT id, '+549112345678', true, true
-- FROM auth.users
-- LIMIT 1;

-- 5. Verificar datos insertados
-- SELECT * FROM whatsapp_configs;
