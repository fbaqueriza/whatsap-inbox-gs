-- ============================================
-- 🔧 AGREGAR COLUMNA phone_number_id A user_whatsapp_config
-- ============================================
-- Esta columna almacenará el phone_number_id de Kapso/Meta
-- para evitar tener que consultarlo cada vez desde la API de Kapso

-- Agregar columna phone_number_id si no existe
ALTER TABLE user_whatsapp_config 
ADD COLUMN IF NOT EXISTS phone_number_id TEXT;

-- Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_config_phone_number_id 
ON user_whatsapp_config(phone_number_id) 
WHERE phone_number_id IS NOT NULL;

-- Comentario para documentación
COMMENT ON COLUMN user_whatsapp_config.phone_number_id IS 'ID del número de teléfono en Kapso/Meta. Se obtiene de la API de Kapso usando kapso_config_id y se guarda aquí para evitar consultas repetidas.';
