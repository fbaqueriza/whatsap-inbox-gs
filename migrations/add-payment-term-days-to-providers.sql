-- Migración para agregar campo de plazo de pago a la tabla providers
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2025-11-13

-- Agregar columna payment_term_days a la tabla providers
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS payment_term_days INTEGER DEFAULT 30;

-- Agregar comentario para documentar el campo
COMMENT ON COLUMN providers.payment_term_days IS 'Plazo de pago en días desde la fecha de factura o entrega hasta el vencimiento del pago. Se usa para calcular automáticamente la fecha de vencimiento de las órdenes. Valor por defecto: 30 días.';

-- Actualizar registros existentes con el valor por defecto si no tienen uno asignado
UPDATE providers 
SET payment_term_days = 30 
WHERE payment_term_days IS NULL;

