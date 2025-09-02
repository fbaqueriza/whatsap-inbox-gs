-- 🚨 MIGRACIÓN INMEDIATA: Crear columnas para campos del modal
-- Ejecutar ESTE SCRIPT en el SQL Editor de Supabase AHORA

-- 1. Agregar columna para fecha de entrega deseada
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS desired_delivery_date DATE;

-- 2. Agregar columna para horarios de entrega deseados
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS desired_delivery_time TEXT[];

-- 3. Agregar columna para método de pago
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo';

-- 4. Agregar columna para archivos adicionales
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS additional_files JSONB;

-- 5. Verificar que las columnas se crearon
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('desired_delivery_date', 'desired_delivery_time', 'payment_method', 'additional_files')
ORDER BY column_name;
