-- Script para agregar la columna order_number a la tabla orders
-- Ejecutar en Supabase SQL Editor

-- Agregar columna order_number si no existe
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

-- Crear índice para mejorar el rendimiento de búsquedas por número de orden
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Actualizar registros existentes con números de orden generados
UPDATE orders 
SET order_number = CONCAT('ORD-', EXTRACT(EPOCH FROM created_at)::BIGINT, '-', SUBSTRING(id::text, 1, 8))
WHERE order_number IS NULL;

-- Hacer la columna NOT NULL después de actualizar los datos existentes
ALTER TABLE orders 
ALTER COLUMN order_number SET NOT NULL;

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN orders.order_number IS 'Número único de orden generado automáticamente';
