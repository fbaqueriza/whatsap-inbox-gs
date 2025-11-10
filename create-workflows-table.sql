-- Crear tabla de workflows para Kapso Platform
CREATE TABLE IF NOT EXISTS workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  triggers TEXT[] DEFAULT '{}',
  actions TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);

-- Habilitar RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Política RLS: usuarios solo pueden ver sus propios workflows
CREATE POLICY "Users can only see their own workflows" ON workflows
  FOR ALL USING (auth.uid() = user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_workflows_updated_at_trigger
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_workflows_updated_at();

-- Insertar algunos workflows de ejemplo
INSERT INTO workflows (user_id, name, description, triggers, actions, status) VALUES
  (
    (SELECT id FROM auth.users LIMIT 1),
    'Notificación de orden creada',
    'Envía notificación automática cuando se crea una nueva orden',
    ARRAY['order_created'],
    ARRAY['send_whatsapp_message', 'create_notification'],
    'active'
  ),
  (
    (SELECT id FROM auth.users LIMIT 1),
    'Alerta de stock bajo',
    'Notifica cuando el stock de un producto está bajo',
    ARRAY['stock_low'],
    ARRAY['send_whatsapp_template', 'send_email'],
    'draft'
  ),
  (
    (SELECT id FROM auth.users LIMIT 1),
    'Confirmación de pago',
    'Confirma automáticamente cuando se recibe un pago',
    ARRAY['payment_received'],
    ARRAY['update_order_status', 'send_whatsapp_message'],
    'active'
  );

-- Comentarios para documentación
COMMENT ON TABLE workflows IS 'Tabla para gestionar workflows de automatización con Kapso Platform';
COMMENT ON COLUMN workflows.triggers IS 'Array de triggers que activan el workflow';
COMMENT ON COLUMN workflows.actions IS 'Array de acciones que ejecuta el workflow';
COMMENT ON COLUMN workflows.config IS 'Configuración específica del workflow en formato JSON';
COMMENT ON COLUMN workflows.status IS 'Estado del workflow: draft, active, inactive';
