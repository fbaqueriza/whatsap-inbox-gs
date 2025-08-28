-- Script para verificar y corregir la estructura de la tabla pending_orders
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura actual de la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'pending_orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si existe el campo user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pending_orders' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Agregar el campo user_id si no existe
        ALTER TABLE pending_orders 
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        RAISE NOTICE '✅ Campo user_id agregado a pending_orders';
    ELSE
        RAISE NOTICE 'ℹ️ Campo user_id ya existe en pending_orders';
    END IF;
END $$;

-- 3. Verificar y crear índices necesarios
CREATE INDEX IF NOT EXISTS idx_pending_orders_provider_phone_status 
ON pending_orders(provider_phone, status);

CREATE INDEX IF NOT EXISTS idx_pending_orders_user_id 
ON pending_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_created_at 
ON pending_orders(created_at);

-- 4. Verificar constraints existentes
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'pending_orders'
AND tc.table_schema = 'public';

-- 5. Limpiar datos obsoletos (opcional)
-- DELETE FROM pending_orders 
-- WHERE created_at < NOW() - INTERVAL '7 days'
-- AND status = 'pending_confirmation';

-- 6. Verificar estructura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'pending_orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Verificar permisos de la tabla
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'pending_orders'
AND table_schema = 'public';
