-- ========================================
-- CONFIGURACIÓN SIMPLE DE SUPABASE REALTIME
-- ========================================

-- 1. Verificar si la publicación ya existe
SELECT 'Verificando publicación Realtime...' as status;

-- 2. Crear publicación Realtime (ejecutar solo si no existe)
-- Si da error "already exists", está bien
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- 3. Agregar tablas específicas (ejecutar uno por uno)
-- Si da error "already exists", está bien
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_contacts;

-- 4. Habilitar RLS
ALTER TABLE kapso_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_contacts ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS
CREATE POLICY "Enable realtime for kapso_messages" ON kapso_messages
FOR SELECT USING (true);

CREATE POLICY "Enable realtime for kapso_conversations" ON kapso_conversations
FOR SELECT USING (true);

CREATE POLICY "Enable realtime for kapso_contacts" ON kapso_contacts
FOR SELECT USING (true);

-- 6. Verificar configuración
SELECT 'Configuración completada. Verificando...' as status;

SELECT 'Publicación Realtime:' as info, pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

SELECT 'Políticas RLS:' as info, schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('kapso_messages', 'kapso_conversations', 'kapso_contacts')
ORDER BY tablename, policyname;
