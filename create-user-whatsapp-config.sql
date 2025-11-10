-- Tabla para configurar WhatsApp de cada usuario
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

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_config_user_id ON user_whatsapp_config(user_id);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_config_phone ON user_whatsapp_config(whatsapp_phone_number);
CREATE INDEX IF NOT EXISTS idx_user_whatsapp_config_kapso ON user_whatsapp_config(kapso_config_id);

-- RLS (Row Level Security)
ALTER TABLE user_whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver su propia configuración
CREATE POLICY "Users can view own whatsapp config" ON user_whatsapp_config
  FOR SELECT USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden insertar su propia configuración
CREATE POLICY "Users can insert own whatsapp config" ON user_whatsapp_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden actualizar su propia configuración
CREATE POLICY "Users can update own whatsapp config" ON user_whatsapp_config
  FOR UPDATE USING (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_whatsapp_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER trigger_update_user_whatsapp_config_updated_at
  BEFORE UPDATE ON user_whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION update_user_whatsapp_config_updated_at();

-- Insertar configuración para el usuario actual (ejemplo)
-- NOTA: Reemplazar 'USER_ID_AQUI' con el ID real del usuario
-- INSERT INTO user_whatsapp_config (user_id, whatsapp_phone_number, kapso_config_id)
-- VALUES ('USER_ID_AQUI', '+541135562673', '15fedb1a-9ac4-4672-b660-8319bffb7635')
-- ON CONFLICT (user_id) DO UPDATE SET
--   whatsapp_phone_number = EXCLUDED.whatsapp_phone_number,
--   kapso_config_id = EXCLUDED.kapso_config_id,
--   updated_at = NOW();
