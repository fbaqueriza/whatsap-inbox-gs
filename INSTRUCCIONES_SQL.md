# 🔧 Instrucciones para Ejecutar SQL en Supabase

## Paso 1: Abrir Supabase Dashboard
1. Ve a: https://supabase.com/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto: **jyalmdhyuftjldewbfzw**

## Paso 2: Abrir SQL Editor
1. En el menú lateral izquierdo, haz clic en **"SQL Editor"**
2. Haz clic en **"New query"** (botón verde en la esquina superior derecha)

## Paso 3: Ejecutar SQL para Órdenes

### Copia y pega este SQL:

```sql
-- Agregar tabla orders a la publicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Verificar
SELECT 'Publicación Realtime:' as info, pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

### Luego:
1. Haz clic en **"Run"** (botón verde en la esquina inferior derecha)
2. Verifica que aparezca "Success. No rows returned" o una tabla con las tablas publicadas

## Paso 4: Ejecutar SQL para Comprobantes (si aún no lo hiciste)

### Copia y pega este SQL:

```sql
-- Agregar payment_receipts a la publicación Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE payment_receipts;
    RAISE NOTICE 'payment_receipts agregado a supabase_realtime';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'payment_receipts ya está en la publicación';
END
$$;

-- Habilitar RLS si no está habilitado
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir SELECT (necesario para Realtime)
DROP POLICY IF EXISTS "Enable realtime for payment_receipts" ON payment_receipts;

CREATE POLICY "Enable realtime for payment_receipts" ON payment_receipts
FOR SELECT USING (true);

-- Verificar que se agregó correctamente
SELECT 'Publicación Realtime:' as info, pubname, schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'payment_receipts';

-- Verificar política creada
SELECT 'Políticas RLS:' as info, schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'payment_receipts' AND policyname LIKE '%realtime%'
ORDER BY policyname;
```

### Luego:
1. Haz clic en **"Run"** (botón verde en la esquina inferior derecha)
2. Verifica que no haya errores

## ✅ Verificación
Después de ejecutar ambos SQLs, deberías ver en los resultados que las tablas `orders` y `payment_receipts` están en la publicación Realtime.

## 🔄 Próximos Pasos
Una vez ejecutados ambos SQLs:
1. Recarga completamente tu aplicación (Ctrl+Shift+R o Cmd+Shift+R)
2. Sube un comprobante de pago con órdenes seleccionadas
3. **La orden debería actualizarse automáticamente a "pagado" en tiempo real** ✨
4. **El comprobante debería enviarse automáticamente por WhatsApp** ✨

