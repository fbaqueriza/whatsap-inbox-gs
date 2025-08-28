-- Eliminar manualmente la orden de L'igiene desde Supabase SQL Editor
-- Ejecutar en Supabase SQL Editor

-- 1. Primero verificar que existe la orden
SELECT 
  id,
  order_id,
  provider_id,
  provider_phone,
  status,
  created_at,
  order_data->'provider'->>'name' as provider_name
FROM pending_orders 
WHERE id = 'aee69daf-7db1-4324-99c6-22c5f8d2f814';

-- 2. Eliminar la orden específica
DELETE FROM pending_orders 
WHERE id = 'aee69daf-7db1-4324-99c6-22c5f8d2f814';

-- 3. Verificar que se eliminó
SELECT COUNT(*) as ordenes_restantes
FROM pending_orders 
WHERE status = 'pending_confirmation';

-- 4. Ver todas las órdenes pendientes restantes (debería ser 0)
SELECT 
  id,
  order_id,
  provider_phone,
  order_data->'provider'->>'name' as provider_name,
  created_at
FROM pending_orders 
WHERE status = 'pending_confirmation'
ORDER BY created_at DESC;
