-- =====================================================
-- FIX: Modificar constraint de CUIT para permitir
-- que diferentes usuarios tengan el mismo CUIT
-- =====================================================
-- Fecha: 2025-01-XX
-- Descripción: Cambiar el constraint único global de CUIT
--              a un constraint único por (user_id, cuit_cuil)
-- =====================================================

-- 1. Eliminar TODOS los constraints únicos globales en cuit_cuil
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Buscar y eliminar todos los constraints únicos en cuit_cuil que NO incluyan user_id
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'providers'::regclass
        AND contype = 'u'
        AND conkey::text LIKE '%cuit%'
        AND conkey::text NOT LIKE '%user_id%'
    LOOP
        EXECUTE format('ALTER TABLE providers DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Constraint eliminado: %', constraint_name;
    END LOOP;
END $$;

-- 2. Eliminar TODOS los índices únicos globales en cuit_cuil
DO $$ 
DECLARE
    index_name text;
BEGIN
    -- Buscar y eliminar todos los índices únicos en cuit_cuil que NO incluyan user_id
    FOR index_name IN
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'providers'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%cuit%'
        AND indexdef NOT LIKE '%user_id%'
    LOOP
        -- Evitar eliminar el nuevo índice que vamos a crear
        IF index_name != 'ux_providers_user_cuit' THEN
            EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
            RAISE NOTICE 'Índice único eliminado: %', index_name;
        END IF;
    END LOOP;
END $$;

-- 3. Eliminar específicamente el constraint ux_providers_cuit si existe (por si acaso)
ALTER TABLE providers DROP CONSTRAINT IF EXISTS ux_providers_cuit;

-- 4. Eliminar específicamente el índice ux_providers_cuit si existe (por si acaso)
DROP INDEX IF EXISTS ux_providers_cuit;

-- 5. Eliminar cualquier otro índice único que pueda estar en cuit_cuil
DROP INDEX IF EXISTS providers_cuit_cuil_key;
DROP INDEX IF EXISTS providers_cuit_cuil_idx;
DROP INDEX IF EXISTS ux_providers_cuit_cuil;

-- 6. Crear un índice único compuesto por (user_id, cuit_cuil)
-- Esto permite que diferentes usuarios tengan el mismo CUIT
-- pero el mismo usuario no puede tener dos proveedores con el mismo CUIT
DROP INDEX IF EXISTS ux_providers_user_cuit; -- Eliminar si existe para recrearlo
CREATE UNIQUE INDEX ux_providers_user_cuit 
ON providers(user_id, cuit_cuil) 
WHERE cuit_cuil IS NOT NULL AND cuit_cuil != '';

-- 7. Agregar un comentario para documentar el cambio
COMMENT ON INDEX ux_providers_user_cuit IS 
'Constraint único que permite que diferentes usuarios tengan el mismo CUIT, pero cada usuario solo puede tener un proveedor con cada CUIT';

-- 8. Verificar que el cambio se aplicó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'ux_providers_user_cuit'
    ) THEN
        RAISE NOTICE '✅ Índice único ux_providers_user_cuit creado correctamente';
    ELSE
        RAISE WARNING '⚠️ No se pudo crear el índice ux_providers_user_cuit';
    END IF;
    
    -- Verificar que no queden constraints únicos globales en cuit_cuil
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint
        WHERE conrelid = 'providers'::regclass
        AND contype = 'u'
        AND conkey::text LIKE '%cuit%'
        AND conkey::text NOT LIKE '%user_id%'
    ) THEN
        RAISE WARNING '⚠️ AÚN EXISTEN constraints únicos globales en cuit_cuil. Revisar manualmente.';
    ELSE
        RAISE NOTICE '✅ No quedan constraints únicos globales en cuit_cuil';
    END IF;
END $$;

