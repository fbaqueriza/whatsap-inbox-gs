-- Agregar tabla orders a la publicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Verificar
SELECT 'Publicación Realtime:' as info, pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

