-- MIGRACIÓN PERMANENTE: Agregar columnas para campos del modal a la tabla orders
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Agregar columna para fecha de entrega deseada
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS desired_delivery_date DATE;

-- 2. Agregar columna para horarios de entrega deseados
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS desired_delivery_time TEXT[];

-- 3. Agregar columna para método de pago
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo';

-- 4. Agregar columna para archivos adicionales (JSONB para flexibilidad)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS additional_files JSONB;

-- 5. Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_orders_desired_delivery_date ON orders(desired_delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

-- 6. Agregar comentarios para documentar las nuevas columnas
COMMENT ON COLUMN orders.desired_delivery_date IS 'Fecha de entrega deseada por el cliente';
COMMENT ON COLUMN orders.desired_delivery_time IS 'Horarios de entrega deseados (array de strings)';
COMMENT ON COLUMN orders.payment_method IS 'Método de pago preferido: efectivo, transferencia, tarjeta, cheque';
COMMENT ON COLUMN orders.additional_files IS 'Archivos adicionales adjuntos a la orden (JSONB)';

-- 7. Verificar que las columnas se crearon correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('desired_delivery_date', 'desired_delivery_time', 'payment_method', 'additional_files')
ORDER BY column_name;
