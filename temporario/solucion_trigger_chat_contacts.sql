-- 🔧 SOLUCIÓN: Error en Trigger chat_contacts
-- Ejecutar en Supabase SQL Editor

-- PASO 1: Eliminar el trigger problemático
DROP TRIGGER IF EXISTS update_contact_last_activity_trigger ON whatsapp_messages;

-- PASO 2: Eliminar la función problemática
DROP FUNCTION IF EXISTS update_contact_last_activity();

-- PASO 3: Crear una nueva función corregida
CREATE OR REPLACE FUNCTION update_contact_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar que NEW.contact_id y NEW.user_id no sean NULL
  IF NEW.contact_id IS NOT NULL THEN
    -- Actualizar chat_contacts con el último mensaje
    UPDATE chat_contacts 
    SET last_activity = NEW.timestamp
    WHERE phone_number = NEW.contact_id::text
    AND (NEW.user_id IS NULL OR user_id = NEW.user_id::uuid);
    
    -- Si no existe el contacto, crearlo
    IF NOT FOUND THEN
      INSERT INTO chat_contacts (
        phone_number,
        user_id,
        last_activity,
        created_at,
        updated_at
      ) VALUES (
        NEW.contact_id::text,
        NEW.user_id::uuid,
        NEW.timestamp,
        NOW(),
        NOW()
      ) ON CONFLICT (phone_number, user_id) 
      DO UPDATE SET 
        last_activity = NEW.timestamp,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 4: Crear el nuevo trigger
CREATE TRIGGER update_contact_last_activity_trigger
  AFTER INSERT OR UPDATE ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_activity();

-- PASO 5: Verificar que el trigger se creó correctamente
SELECT 
  'VERIFICACIÓN TRIGGER' as info,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'whatsapp_messages';

-- PASO 6: Probar inserción de mensaje para verificar que funciona
INSERT INTO whatsapp_messages (
  id,
  content,
  timestamp,
  message_sid,
  contact_id,
  message_type,
  user_id,
  status
) VALUES (
  gen_random_uuid(),
  'Mensaje de prueba trigger',
  NOW(),
  'test_trigger_123',
  '+5491112345678',
  'received',
  NULL,
  'delivered'
) RETURNING id, message_sid, user_id, contact_id;

-- PASO 7: Verificar que se creó el contacto
SELECT 
  'VERIFICACIÓN CONTACTO CREADO' as info,
  phone_number,
  user_id,
  last_activity
FROM chat_contacts 
WHERE phone_number = '+5491112345678';

-- PASO 8: Limpiar datos de prueba
DELETE FROM whatsapp_messages WHERE message_sid = 'test_trigger_123';
DELETE FROM chat_contacts WHERE phone_number = '+5491112345678';

-- ✅ RESULTADO ESPERADO:
-- El trigger debe funcionar sin errores de tipo UUID
-- Se debe crear automáticamente un contacto en chat_contacts
-- No debe haber errores de comparación de tipos
