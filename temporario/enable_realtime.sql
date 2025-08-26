-- Script para habilitar Supabase Realtime en las tablas relevantes
-- Ejecutar en Supabase SQL Editor

-- Habilitar Realtime para la tabla whatsapp_messages
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;

-- Habilitar Realtime para la tabla orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Habilitar Realtime para la tabla pending_orders
ALTER PUBLICATION supabase_realtime ADD TABLE pending_orders;

-- Habilitar Realtime para la tabla providers (opcional)
ALTER PUBLICATION supabase_realtime ADD TABLE providers;

-- Verificar que las tablas están habilitadas para Realtime
SELECT 
    schemaname,
    tablename,
    attname,
    atttypid::regtype as data_type
FROM pg_publication_tables pt
JOIN pg_attribute a ON a.attrelid = pt.tablename::regclass
WHERE pt.pubname = 'supabase_realtime'
AND a.attnum > 0
AND NOT a.attisdropped
ORDER BY schemaname, tablename, attnum;

-- Verificar el estado de la publicación
SELECT 
    pubname,
    puballtables,
    pubinsert,
    pubupdate,
    pubdelete
FROM pg_publication
WHERE pubname = 'supabase_realtime';
