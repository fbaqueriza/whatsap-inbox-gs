-- Agregar columna phone_number_id a user_whatsapp_config
ALTER TABLE user_whatsapp_config 
ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR(100);

-- Actualizar el registro existente con el phone_number_id
UPDATE user_whatsapp_config 
SET phone_number_id = '842420582288633'
WHERE id = 'cb589012-dafb-4338-ab81-9ccfd2ca51e1';

-- Verificar que se actualizó correctamente
SELECT id, user_id, whatsapp_phone_number, kapso_config_id, phone_number_id, is_active
FROM user_whatsapp_config
WHERE id = 'cb589012-dafb-4338-ab81-9ccfd2ca51e1';


