-- ============================================
-- 📱 CONFIGURACIÓN DE WHATSAPP POR USUARIO
-- ============================================
-- Tabla para almacenar configuraciones de números de WhatsApp
-- Cada usuario puede tener su propio número de WhatsApp configurado

CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  kapso_config_id VARCHAR(100), -- ID de configuración en Kapso
  meta_phone_number_id VARCHAR(100), -- ID de número en Meta (si aplica)
  meta_access_token TEXT, -- Token específico del número (si aplica)
  is_sandbox BOOLEAN DEFAULT false, -- Indica si es número de sandbox
  is_active BOOLEAN DEFAULT true, -- Indica si la configuración está activa
  webhook_url TEXT, -- URL del webhook configurado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: Un usuario solo puede tener una configuración activa
  CONSTRAINT unique_active_config_per_user UNIQUE (user_id) DEFERRABLE INITIALLY DEFERRED
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_user_id ON whatsapp_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_phone_number ON whatsapp_configs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_kapso_config_id ON whatsapp_configs(kapso_config_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_active ON whatsapp_configs(is_active) WHERE is_active = true;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_whatsapp_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER trigger_update_whatsapp_configs_updated_at
  BEFORE UPDATE ON whatsapp_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_configs_updated_at();

-- Política RLS (Row Level Security)
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver y modificar sus propias configuraciones
CREATE POLICY "Users can manage their own whatsapp configs" ON whatsapp_configs
  FOR ALL USING (auth.uid() = user_id);

-- Comentarios para documentación
COMMENT ON TABLE whatsapp_configs IS 'Configuraciones de números de WhatsApp por usuario';
COMMENT ON COLUMN whatsapp_configs.user_id IS 'ID del usuario propietario de la configuración';
COMMENT ON COLUMN whatsapp_configs.phone_number IS 'Número de teléfono de WhatsApp (formato: +549112345678)';
COMMENT ON COLUMN whatsapp_configs.kapso_config_id IS 'ID de la configuración en Kapso API';
COMMENT ON COLUMN whatsapp_configs.meta_phone_number_id IS 'ID del número en Meta Business API (si aplica)';
COMMENT ON COLUMN whatsapp_configs.meta_access_token IS 'Token de acceso de Meta para este número específico';
COMMENT ON COLUMN whatsapp_configs.is_sandbox IS 'Indica si es un número de sandbox para testing';
COMMENT ON COLUMN whatsapp_configs.is_active IS 'Indica si esta configuración está activa y en uso';
COMMENT ON COLUMN whatsapp_configs.webhook_url IS 'URL del webhook configurado para este número';
