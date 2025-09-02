-- MIGRACIÓN DE DATOS EXISTENTES: Extraer información del modal desde las notas
-- Ejecutar DESPUÉS de crear las nuevas columnas

-- 1. Migrar fechas de entrega desde las notas
UPDATE orders 
SET desired_delivery_date = (
  CASE 
    WHEN notes ~ '📅 Fecha de entrega: (\d{4}-\d{2}-\d{2})' 
    THEN (regexp_match(notes, '📅 Fecha de entrega: (\d{4}-\d{2}-\d{2})'))[1]::DATE
    ELSE NULL 
  END
)
WHERE notes ~ '📅 Fecha de entrega: (\d{4}-\d{2}-\d{2})';

-- 2. Migrar horarios de entrega desde las notas
UPDATE orders 
SET desired_delivery_time = (
  CASE 
    WHEN notes ~ '⏰ Horarios: (.+)' 
    THEN string_to_array(
      (regexp_match(notes, '⏰ Horarios: (.+)'))[1], 
      ', '
    )
    ELSE NULL 
  END
)
WHERE notes ~ '⏰ Horarios: (.+)';

-- 3. Migrar métodos de pago desde las notas
UPDATE orders 
SET payment_method = (
  CASE 
    WHEN notes ~ '💳 Forma de pago: (transferencia|tarjeta|cheque)' 
    THEN (regexp_match(notes, '💳 Forma de pago: (transferencia|tarjeta|cheque)'))[1]
    ELSE 'efectivo' 
  END
)
WHERE notes ~ '💳 Forma de pago: (transferencia|tarjeta|cheque)';

-- 4. Migrar información de archivos desde las notas
UPDATE orders 
SET additional_files = (
  CASE 
    WHEN notes ~ '📎 Archivos: (\d+) adjunto\(s\)' 
    THEN jsonb_build_object(
      'count', (regexp_match(notes, '📎 Archivos: (\d+) adjunto\(s\)'))[1]::integer,
      'migrated_from_notes', true,
      'migration_date', now()
    )
    ELSE NULL 
  END
)
WHERE notes ~ '📎 Archivos: (\d+) adjunto\(s\)';

-- 5. Limpiar las notas (opcional - comentar si quieres mantener la información)
-- UPDATE orders 
-- SET notes = regexp_replace(notes, '\n\n📅 Fecha de entrega: [^\n]*', '', 'g')
-- WHERE notes ~ '📅 Fecha de entrega:';

-- UPDATE orders 
-- SET notes = regexp_replace(notes, '\n\n⏰ Horarios: [^\n]*', '', 'g')
-- WHERE notes ~ '⏰ Horarios:';

-- UPDATE orders 
-- SET notes = regexp_replace(notes, '\n\n💳 Forma de pago: [^\n]*', '', 'g')
-- WHERE notes ~ '💳 Forma de pago:';

-- UPDATE orders 
-- SET notes = regexp_replace(notes, '\n\n📎 Archivos: [^\n]*', '', 'g')
-- WHERE notes ~ '📎 Archivos:';

-- 6. Verificar la migración
SELECT 
  id,
  order_number,
  notes,
  desired_delivery_date,
  desired_delivery_time,
  payment_method,
  additional_files
FROM orders 
WHERE desired_delivery_date IS NOT NULL 
   OR desired_delivery_time IS NOT NULL 
   OR payment_method != 'efectivo' 
   OR additional_files IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 7. Estadísticas de migración
SELECT 
  COUNT(*) as total_orders,
  COUNT(desired_delivery_date) as orders_with_delivery_date,
  COUNT(desired_delivery_time) as orders_with_delivery_time,
  COUNT(CASE WHEN payment_method != 'efectivo' THEN 1 END) as orders_with_custom_payment,
  COUNT(additional_files) as orders_with_files
FROM orders;
