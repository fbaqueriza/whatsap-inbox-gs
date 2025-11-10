-- ============================================
-- 📱 CONFIGURACIÓN DE WHATSAPP POR USUARIO (VERSIÓN MÍNIMA)
-- ============================================

-- Crear tabla whatsapp_configs sin referencias externas
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

-- Crear índices básicos
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_whatsapp_configs_updated_at ON whatsapp_configs;
CREATE TRIGGER trigger_update_whatsapp_configs_updated_at
  BEFORE UPDATE ON whatsapp_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_configs_updated_at();

-- Habilitar RLS
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Política RLS básica
DROP POLICY IF EXISTS "Users can manage their own whatsapp configs" ON whatsapp_configs;
CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs
  FOR ALL USING (auth.uid() = user_id);

-- Comentarios
COMMENT ON TABLE whatsapp_configs IS 'Configuraciones de números de WhatsApp por usuario';
COMMENT ON COLUMN whatsapp_configs.user_id IS 'ID del usuario propietario de la configuración';
COMMENT ON COLUMN whatsapp_configs.phone_number IS 'Número de teléfono de WhatsApp (formato: +549112345678)';
COMMENT ON COLUMN whatsapp_configs.is_sandbox IS 'Indica si es un número de sandbox para testing';
COMMENT ON COLUMN whatsapp_configs.is_active IS 'Indica si esta configuración está activa y en uso';
