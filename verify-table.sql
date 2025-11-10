-- Verificar si la tabla existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_whatsapp_config';

-- Si no existe, crearla
CREATE TABLE IF NOT EXISTS user_whatsapp_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_phone_number TEXT NOT NULL,
  kapso_config_id TEXT,
  is_active BOOLEAN DEFAULT true,
  is_sandbox BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Verificar que se creó
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_whatsapp_config';
