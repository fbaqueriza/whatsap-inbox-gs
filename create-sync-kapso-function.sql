-- Crear función para sincronizar datos de Kapso (versión simplificada)
CREATE OR REPLACE FUNCTION public.sync_kapso_data(
  p_contact_name TEXT,
  p_content TEXT,
  p_conversation_id TEXT,
  p_from_number TEXT,
  p_message_id TEXT,
  p_message_type TEXT,
  p_phone_number TEXT,
  p_timestamp TEXT,
  p_to_number TEXT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Insertar o actualizar mensaje en whatsapp_messages (usando UUID generado)
  INSERT INTO public.whatsapp_messages (
    id,
    content,
    timestamp,
    contact_id,
    user_id,
    status
  ) VALUES (
    gen_random_uuid(),
    p_content,
    to_timestamp(p_timestamp::bigint),
    p_phone_number,
    p_user_id,
    'delivered'
  );

  -- Insertar o actualizar contacto
  INSERT INTO public.whatsapp_contacts (
    phone_number,
    name,
    user_id,
    last_message_at
  ) VALUES (
    p_phone_number,
    p_contact_name,
    p_user_id,
    to_timestamp(p_timestamp::bigint)
  )
  ON CONFLICT (phone_number, user_id) DO UPDATE SET
    name = EXCLUDED.name,
    last_message_at = EXCLUDED.last_message_at;

  -- Retornar resultado exitoso
  result := json_build_object(
    'success', true,
    'message', 'Datos sincronizados correctamente',
    'message_id', p_message_id
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, retornar información del error
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message_id', p_message_id
    );
    RETURN result;
END;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.sync_kapso_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_kapso_data TO service_role;
