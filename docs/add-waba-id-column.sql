-- 🔧 AGREGAR COLUMNA waba_id A user_whatsapp_config
-- Esta columna almacenará el WABA_ID (WhatsApp Business Account ID) obtenido de Kapso
-- para evitar consultas repetidas a la API de Kapso

-- Agregar columna waba_id si no existe
ALTER TABLE user_whatsapp_config 
ADD COLUMN IF NOT EXISTS waba_id TEXT;

-- Crear índice para optimizar búsquedas por waba_id
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_config_waba_id 
ON user_whatsapp_config(waba_id) 
WHERE waba_id IS NOT NULL;

-- Comentario para documentar la columna
COMMENT ON COLUMN user_whatsapp_config.waba_id IS 'WhatsApp Business Account ID obtenido de Kapso. Se guarda aquí para evitar consultas repetidas a la API de Kapso.';

