-- Script para arreglar la tabla pending_orders
-- Ejecutar en Supabase SQL Editor

-- Agregar columna order_data si no existe
ALTER TABLE pending_orders
ADD COLUMN IF NOT EXISTS order_data JSONB;

-- Crear índice para mejorar el rendimiento de búsquedas por order_data
CREATE INDEX IF NOT EXISTS idx_pending_orders_order_data ON pending_orders USING GIN (order_data);

-- Hacer la columna NOT NULL después de actualizar los datos existentes
-- Primero actualizar registros existentes con datos vacíos
UPDATE pending_orders
SET order_data = '{}'::jsonb
WHERE order_data IS NULL;

-- Luego hacer la columna NOT NULL
ALTER TABLE pending_orders
ALTER COLUMN order_data SET NOT NULL;

-- Comentario para documentar el propósito de la columna
COMMENT ON COLUMN pending_orders.order_data IS 'Datos completos de la orden en formato JSONB';
