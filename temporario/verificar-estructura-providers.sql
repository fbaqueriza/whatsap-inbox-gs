-- Script para verificar y actualizar la estructura de la tabla providers
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar la estructura actual de la tabla providers
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'providers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si existe el campo default_delivery_time
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'providers' 
AND table_schema = 'public'
AND column_name = 'default_delivery_time';

-- 3. Si no existe, agregar el campo default_delivery_time
-- (Ejecutar solo si el paso 2 no retorna resultados)

DO $$
BEGIN
    -- Verificar si la columna existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'providers' 
        AND table_schema = 'public'
        AND column_name = 'default_delivery_time'
    ) THEN
        -- Agregar la columna
        ALTER TABLE providers 
        ADD COLUMN default_delivery_time TEXT[] DEFAULT '{}';
        
        RAISE NOTICE 'Columna default_delivery_time agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna default_delivery_time ya existe';
    END IF;
END $$;

-- 4. Verificar que la columna se agregó correctamente
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'providers' 
AND table_schema = 'public'
AND column_name = 'default_delivery_time';

-- 5. Actualizar algunos proveedores existentes con horarios de ejemplo
UPDATE providers 
SET default_delivery_time = ARRAY['08:00', '14:00', '16:00']
WHERE name LIKE '%L''igiene%'
AND (default_delivery_time IS NULL OR array_length(default_delivery_time, 1) = 0);

-- 6. Verificar los datos actualizados
SELECT 
    id,
    name,
    default_delivery_time,
    array_length(default_delivery_time, 1) as time_count
FROM providers 
WHERE default_delivery_time IS NOT NULL 
AND array_length(default_delivery_time, 1) > 0;

-- 7. Mostrar todos los proveedores para verificar
SELECT 
    id,
    name,
    phone,
    default_delivery_time,
    COALESCE(array_length(default_delivery_time, 1), 0) as time_count
FROM providers 
ORDER BY name;
