-- =====================================================
-- SISTEMA DE COMPROBANTES DE PAGO - ESQUEMA DE BASE DE DATOS
-- Fecha: 22/09/2025
-- =====================================================

-- Tabla principal de comprobantes de pago
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Información del archivo
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT CHECK (file_type IN ('transferencia', 'cheque', 'efectivo', 'tarjeta', 'other')) DEFAULT 'transferencia',
  mime_type TEXT,
  
  -- Datos del comprobante
  receipt_number TEXT,
  payment_amount DECIMAL(15,2),
  payment_currency TEXT DEFAULT 'ARS',
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('transferencia', 'cheque', 'efectivo', 'tarjeta', 'other')),
  
  -- Datos de asignación automática
  auto_assigned_provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  auto_assigned_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  assignment_confidence FLOAT CHECK (assignment_confidence >= 0 AND assignment_confidence <= 1),
  assignment_method TEXT CHECK (assignment_method IN ('cuit_match', 'amount_match', 'provider_match', 'manual')),
  
  -- Datos de envío
  sent_to_provider BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  whatsapp_message_id TEXT,
  
  -- Estado y metadatos
  status TEXT CHECK (status IN ('pending', 'processed', 'assigned', 'sent', 'error')) DEFAULT 'pending',
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de intentos de asignación automática de comprobantes
CREATE TABLE IF NOT EXISTS payment_receipt_assignment_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID REFERENCES payment_receipts(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Método de asignación
  assignment_method TEXT CHECK (assignment_method IN ('cuit_match', 'amount_match', 'provider_match', 'date_match', 'manual')),
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Detalles del intento
  match_details JSONB,
  success BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones de comprobantes de pago
CREATE TABLE IF NOT EXISTS payment_receipt_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID REFERENCES payment_receipts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo de notificación
  notification_type TEXT CHECK (notification_type IN ('receipt_uploaded', 'receipt_processed', 'receipt_assigned', 'receipt_sent', 'processing_error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Estado
  read BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_id ON payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_provider_id ON payment_receipts(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_order_id ON payment_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_file_type ON payment_receipts(file_type);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_date ON payment_receipts(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_created_at ON payment_receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_sent_to_provider ON payment_receipts(sent_to_provider);

CREATE INDEX IF NOT EXISTS idx_receipt_assignment_attempts_receipt_id ON payment_receipt_assignment_attempts(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_assignment_attempts_provider_id ON payment_receipt_assignment_attempts(provider_id);
CREATE INDEX IF NOT EXISTS idx_receipt_assignment_attempts_order_id ON payment_receipt_assignment_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipt_assignment_attempts_success ON payment_receipt_assignment_attempts(success);

CREATE INDEX IF NOT EXISTS idx_payment_receipt_notifications_user_id ON payment_receipt_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipt_notifications_read ON payment_receipt_notifications(read);
CREATE INDEX IF NOT EXISTS idx_payment_receipt_notifications_created_at ON payment_receipt_notifications(created_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_payment_receipts_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_payment_receipts_updated_at 
  BEFORE UPDATE ON payment_receipts 
  FOR EACH ROW EXECUTE FUNCTION update_payment_receipts_updated_at_column();

-- RLS (Row Level Security) - Solo el usuario puede ver sus propios comprobantes
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipt_assignment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipt_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own payment receipts" ON payment_receipts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment receipts" ON payment_receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment receipts" ON payment_receipts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own receipt assignment attempts" ON payment_receipt_assignment_attempts
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM payment_receipts WHERE id = receipt_id));

CREATE POLICY "Users can view their own receipt notifications" ON payment_receipt_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipt notifications" ON payment_receipt_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Comentarios para documentación
COMMENT ON TABLE payment_receipts IS 'Tabla principal para almacenar comprobantes de pago enviados a proveedores';
COMMENT ON TABLE payment_receipt_assignment_attempts IS 'Registro de intentos automáticos de asignación de comprobantes a proveedores y órdenes';
COMMENT ON TABLE payment_receipt_notifications IS 'Notificaciones relacionadas con el procesamiento de comprobantes de pago';

COMMENT ON COLUMN payment_receipts.file_type IS 'Tipo de comprobante: transferencia, cheque, efectivo, tarjeta, other';
COMMENT ON COLUMN payment_receipts.payment_method IS 'Método de pago utilizado';
COMMENT ON COLUMN payment_receipts.status IS 'Estado del procesamiento: pending, processed, assigned, sent, error';
COMMENT ON COLUMN payment_receipts.assignment_confidence IS 'Confianza en la asignación automática (0-1)';
COMMENT ON COLUMN payment_receipts.sent_to_provider IS 'Indica si el comprobante fue enviado al proveedor via WhatsApp';
