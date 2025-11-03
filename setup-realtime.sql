-- ========================================
-- CONFIGURACIÓN DE SUPABASE REALTIME
-- ========================================

-- 1. Crear publicación Realtime (si ya existe, dará error pero no importa)
DO $$
BEGIN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- La publicación ya existe, continuar
END
$$;

-- 2. Agregar tablas de Kapso a la publicación (si no están ya)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE kapso_messages;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- La tabla ya está en la publicación
END
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE kapso_conversations;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- La tabla ya está en la publicación
END
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE kapso_contacts;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- La tabla ya está en la publicación
END
$$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE payment_receipts;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- La tabla ya está en la publicación
END
$$;

-- 3. Habilitar RLS en las tablas
ALTER TABLE kapso_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas para permitir SELECT (necesario para Realtime)
CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_messages" ON kapso_messages
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_conversations" ON kapso_conversations
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_contacts" ON kapso_contacts
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable realtime for payment_receipts" ON payment_receipts
FOR SELECT USING (true);

-- 5. Verificar configuración
SELECT 'Publicación Realtime:' as info, pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

SELECT 'Políticas RLS:' as info, schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('kapso_messages', 'kapso_conversations', 'kapso_contacts', 'payment_receipts')
ORDER BY tablename, policyname;
