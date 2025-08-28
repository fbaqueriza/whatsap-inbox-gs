-- Diagnóstico de órdenes pendientes
-- Ejecutar en Supabase SQL Editor

-- 1. Ver todas las órdenes pendientes
SELECT 
  id,
  order_id,
  provider_id,
  provider_phone,
  status,
  created_at,
  order_data->>'provider' as provider_name
FROM pending_orders 
WHERE status = 'pending_confirmation'
ORDER BY created_at DESC;

-- 2. Ver órdenes pendientes específicas de L'igiene
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
  AND order_data->'provider'->>'name' ILIKE '%ligiene%'
ORDER BY created_at DESC;

-- 3. Ver órdenes pendientes por número de teléfono
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
  AND provider_phone = '+5491135562673'  -- Número de L'igiene
ORDER BY created_at DESC;

-- 4. Limpiar órdenes pendientes obsoletas (más de 1 hora)
DELETE FROM pending_orders 
WHERE status = 'pending_confirmation'
  AND created_at < NOW() - INTERVAL '1 hour';

-- 5. Verificar estructura de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'pending_orders'
ORDER BY ordinal_position;
