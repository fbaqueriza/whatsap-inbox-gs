-- Tabla para registrar errores de WhatsApp Business API
-- Esta tabla permite analizar patrones de errores y implementar estrategias de recuperación

CREATE TABLE IF NOT EXISTS whatsapp_error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_code INTEGER NOT NULL,
  error_title TEXT,
  error_message TEXT,
  phone_number TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('template', 'text')),
  attempt INTEGER NOT NULL DEFAULT 1,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_logs_phone_number ON whatsapp_error_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_logs_error_code ON whatsapp_error_logs(error_code);
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_logs_timestamp ON whatsapp_error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_whatsapp_error_logs_resolved ON whatsapp_error_logs(resolved);

-- Comentarios para documentación
COMMENT ON TABLE whatsapp_error_logs IS 'Registro de errores de WhatsApp Business API para análisis y recuperación';
COMMENT ON COLUMN whatsapp_error_logs.error_code IS 'Código de error de WhatsApp Business API';
COMMENT ON COLUMN whatsapp_error_logs.phone_number IS 'Número de teléfono que causó el error';
COMMENT ON COLUMN whatsapp_error_logs.message_type IS 'Tipo de mensaje: template o text';
COMMENT ON COLUMN whatsapp_error_logs.attempt IS 'Número de intento cuando ocurrió el error';
COMMENT ON COLUMN whatsapp_error_logs.resolved IS 'Indica si el error fue resuelto';
COMMENT ON COLUMN whatsapp_error_logs.resolution_notes IS 'Notas sobre cómo se resolvió el error';

-- Función para marcar errores como resueltos
CREATE OR REPLACE FUNCTION mark_whatsapp_error_resolved(
  error_id UUID,
  notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE whatsapp_error_logs 
  SET resolved = TRUE, 
      resolved_at = NOW(),
      resolution_notes = COALESCE(notes, resolution_notes)
  WHERE id = error_id;
END;
$$ LANGUAGE plpgsql;

-- Vista para estadísticas de errores
CREATE OR REPLACE VIEW whatsapp_error_stats AS
SELECT 
  phone_number,
  COUNT(*) as total_errors,
  COUNT(*) FILTER (WHERE error_code IN (131047, 131049)) as engagement_errors,
  COUNT(*) FILTER (WHERE error_code = 131051) as rate_limit_errors,
  COUNT(*) FILTER (WHERE error_code IN (131026, 131027)) as phone_errors,
  MAX(timestamp) as last_error_date,
  COUNT(*) FILTER (WHERE resolved = TRUE) as resolved_errors,
  CASE 
    WHEN COUNT(*) FILTER (WHERE error_code IN (131047, 131049)) >= 3 THEN TRUE 
    ELSE FALSE 
  END as is_blocked
FROM whatsapp_error_logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY phone_number;

-- Política RLS (si es necesario)
ALTER TABLE whatsapp_error_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserción desde el servicio
CREATE POLICY "Allow service role to insert error logs" ON whatsapp_error_logs
  FOR INSERT WITH CHECK (true);

-- Política para permitir lectura desde el servicio
CREATE POLICY "Allow service role to read error logs" ON whatsapp_error_logs
  FOR SELECT USING (true);

-- Política para permitir actualización desde el servicio
CREATE POLICY "Allow service role to update error logs" ON whatsapp_error_logs
  FOR UPDATE USING (true);
