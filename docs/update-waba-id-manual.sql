-- 🔧 ACTUALIZAR WABA_ID MANUALMENTE PARA USUARIOS ESPECÍFICOS
-- Este script permite actualizar el WABA_ID directamente en Supabase
-- para usuarios que ya tienen el WABA_ID conocido (ej: 1123051623072203)

-- Ejemplo: Actualizar WABA_ID para un usuario específico
-- Reemplaza 'USER_ID_AQUI' con el ID del usuario real
UPDATE user_whatsapp_config 
SET waba_id = '1123051623072203'
WHERE user_id = 'USER_ID_AQUI'  -- Reemplazar con el ID real del usuario
  AND is_active = true;

-- Verificar que se actualizó correctamente
SELECT 
  user_id,
  whatsapp_phone_number,
  kapso_config_id,
  waba_id,
  is_active
FROM user_whatsapp_config
WHERE waba_id = '1123051623072203';

-- Actualizar múltiples usuarios a la vez (si tienes sus user_ids)
-- UPDATE user_whatsapp_config 
-- SET waba_id = '1123051623072203'
-- WHERE user_id IN (
--   'user-id-1',
--   'user-id-2',
--   'user-id-3'
-- )
-- AND is_active = true;

