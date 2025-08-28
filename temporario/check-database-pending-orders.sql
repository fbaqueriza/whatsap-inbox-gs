-- Verificar pedidos pendientes en la base de datos
SELECT 
  id,
  order_id,
  provider_id,
  provider_phone,
  status,
  created_at,
  order_data->'provider'->>'name' as provider_name
FROM pending_orders 
WHERE status = 'pending_confirmation'
ORDER BY created_at DESC;

-- Verificar específicamente el número +5491135562673
SELECT 
  id,
  order_id,
  provider_id,
  provider_phone,
  status,
  created_at
FROM pending_orders 
WHERE provider_phone = '+5491135562673'
  AND status = 'pending_confirmation';

-- Verificar todos los números de teléfono únicos
SELECT DISTINCT
  provider_phone,
  COUNT(*) as count
FROM pending_orders 
WHERE status = 'pending_confirmation'
GROUP BY provider_phone
ORDER BY count DESC;
