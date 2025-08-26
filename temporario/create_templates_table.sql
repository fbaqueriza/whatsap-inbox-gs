-- Script para crear la tabla de templates de WhatsApp
-- Ejecutar en Supabase SQL Editor

-- Crear tabla para almacenar el estado de templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('APPROVED', 'REJECTED', 'PENDING', 'DISABLED')),
  quality_rating TEXT CHECK (quality_rating IN ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),
  components JSONB DEFAULT '[]'::jsonb,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON whatsapp_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_quality ON whatsapp_templates(quality_rating);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_last_updated ON whatsapp_templates(last_updated);

-- Habilitar RLS (Row Level Security)
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso a todos los usuarios autenticados
CREATE POLICY "Allow authenticated users to access templates" ON whatsapp_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Habilitar Realtime para la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_templates;

-- Verificar que la tabla se creó correctamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'whatsapp_templates'
ORDER BY ordinal_position;

-- Verificar que Realtime está habilitado
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'whatsapp_templates';
