-- ============================================
-- 🔍 SCRIPT SQL: VERIFICAR ESTRUCTURA DE user_whatsapp_config
-- ============================================

-- 1. Verificar la estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_whatsapp_config'
ORDER BY ordinal_position;

-- 2. Verificar si la tabla existe
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'user_whatsapp_config';

-- 3. Verificar datos existentes en la tabla
SELECT * FROM user_whatsapp_config LIMIT 5;
