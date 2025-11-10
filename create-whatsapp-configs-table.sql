-- Crear tabla whatsapp_configs
CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  kapso_config_id VARCHAR(100),
  meta_phone_number_id VARCHAR(100),
  meta_access_token TEXT,
  is_sandbox BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Política RLS
CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs
  FOR ALL USING (auth.uid() = user_id);
