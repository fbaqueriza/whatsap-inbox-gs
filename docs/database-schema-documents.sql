-- =====================================================
-- SISTEMA DE GESTIÓN DE DOCUMENTOS - ESQUEMA DE BASE DE DATOS
-- Fecha: 17/09/2025
-- =====================================================

-- Tabla principal de documentos
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Información del archivo
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT CHECK (file_type IN ('catalogo', 'factura', 'comprobante', 'foto', 'other')),
  mime_type TEXT,
  
  -- Datos de WhatsApp
  whatsapp_message_id TEXT,
  sender_phone TEXT,
  sender_type TEXT CHECK (sender_type IN ('provider', 'user')) NOT NULL,
  
  -- Datos de OCR
  ocr_data JSONB,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  extracted_text TEXT,
  
  -- Estado y metadatos
  status TEXT CHECK (status IN ('pending', 'processing', 'processed', 'assigned', 'error')) DEFAULT 'pending',
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de intentos de asignación automática
CREATE TABLE IF NOT EXISTS document_assignment_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Método de asignación
  assignment_method TEXT CHECK (assignment_method IN ('cuit_match', 'date_match', 'phone_match', 'manual')),
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Detalles del intento
  match_details JSONB,
  success BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones de documentos
CREATE TABLE IF NOT EXISTS document_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo de notificación
  notification_type TEXT CHECK (notification_type IN ('document_received', 'document_processed', 'document_assigned', 'processing_error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Estado
  read BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_provider_id ON documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_documents_order_id ON documents(order_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_sender_type ON documents(sender_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_sender_phone ON documents(sender_phone);

CREATE INDEX IF NOT EXISTS idx_assignment_attempts_document_id ON document_assignment_attempts(document_id);
CREATE INDEX IF NOT EXISTS idx_assignment_attempts_order_id ON document_assignment_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_assignment_attempts_success ON document_assignment_attempts(success);

CREATE INDEX IF NOT EXISTS idx_document_notifications_user_id ON document_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_document_notifications_read ON document_notifications(read);
CREATE INDEX IF NOT EXISTS idx_document_notifications_created_at ON document_notifications(created_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Solo el usuario puede ver sus propios documentos
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_assignment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own assignment attempts" ON document_assignment_attempts
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM documents WHERE id = document_id));

CREATE POLICY "Users can view their own notifications" ON document_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON document_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Comentarios para documentación
COMMENT ON TABLE documents IS 'Tabla principal para almacenar todos los documentos recibidos por WhatsApp';
COMMENT ON TABLE document_assignment_attempts IS 'Registro de intentos automáticos de asignación de documentos a órdenes';
COMMENT ON TABLE document_notifications IS 'Notificaciones relacionadas con el procesamiento de documentos';

COMMENT ON COLUMN documents.file_type IS 'Tipo de documento: catalogo, factura, comprobante, foto, other';
COMMENT ON COLUMN documents.sender_type IS 'Quien envió el documento: provider o user';
COMMENT ON COLUMN documents.status IS 'Estado del procesamiento: pending, processing, processed, assigned, error';
COMMENT ON COLUMN documents.confidence_score IS 'Confianza en la extracción OCR (0-1)';
COMMENT ON COLUMN documents.ocr_data IS 'Datos estructurados extraídos por OCR (JSON)';
