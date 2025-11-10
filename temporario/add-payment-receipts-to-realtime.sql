-- ========================================
-- AGREGAR payment_receipts A REALTIME
-- ========================================
-- 
-- INSTRUCCIONES:
-- 1. Copiar este archivo completo
-- 2. Ir a Supabase Dashboard: https://supabase.com/dashboard
-- 3. SQL Editor → New query
-- 4. Pegar y ejecutar
-- ========================================

-- 1. Verificar si la tabla existe
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'payment_receipts';

-- 2. Agregar payment_receipts a la publicación Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE payment_receipts;
    RAISE NOTICE 'payment_receipts agregado a supabase_realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'payment_receipts ya está en la publicación';
END
$$;

-- 3. Habilitar RLS si no está habilitado
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- 4. Crear política para permitir SELECT (necesario para Realtime)
DROP POLICY IF EXISTS "Enable realtime for payment_receipts" ON payment_receipts;

CREATE POLICY "Enable realtime for payment_receipts" ON payment_receipts
FOR SELECT USING (true);

-- 5. Verificar que se agregó correctamente
SELECT 'Publicación Realtime:' as info, pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'payment_receipts';

-- 6. Verificar política creada
SELECT 'Políticas RLS:' as info, schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'payment_receipts' AND policyname LIKE '%realtime%'
ORDER BY policyname;

