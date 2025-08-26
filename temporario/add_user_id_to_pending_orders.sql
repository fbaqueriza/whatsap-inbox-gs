-- Script para agregar el campo user_id a la tabla pending_orders
-- Ejecutar en Supabase SQL Editor

-- Agregar el campo user_id a la tabla pending_orders
ALTER TABLE pending_orders 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Crear un índice para mejorar el rendimiento de las consultas por usuario
CREATE INDEX idx_pending_orders_user_id ON pending_orders(user_id);

-- Agregar comentario a la tabla para documentar el cambio
COMMENT ON COLUMN pending_orders.user_id IS 'ID del usuario que creó el pedido pendiente';

-- Verificar que la tabla se actualizó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pending_orders' 
ORDER BY ordinal_position;
