# 🔧 Configuración de Supabase Realtime

## Paso 1: Acceder al Dashboard de Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto: `jyalmdhyuftjldewbfzw`

## Paso 2: Habilitar Realtime

1. En el menú lateral, ve a **"Replication"** o **"Realtime"**
2. Si no ves la opción, ve a **"Settings"** → **"API"**
3. Busca la sección **"Realtime"** y asegúrate de que esté **habilitado**

## Paso 3: Configurar Publicación Realtime

1. Ve a **"Database"** → **"Replication"**
2. Busca la sección **"Publications"**
3. Asegúrate de que existe una publicación llamada `supabase_realtime`
4. Si no existe, créala con este SQL:

```sql
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
```

## Paso 4: Agregar Tablas a la Publicación

Ejecuta este SQL en el **SQL Editor** de Supabase:

```sql
-- Agregar tablas de Kapso a la publicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE kapso_contacts;
```

## Paso 5: Configurar Políticas RLS

Ejecuta este SQL para permitir Realtime:

```sql
-- Habilitar RLS para Realtime
ALTER TABLE kapso_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapso_contacts ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir SELECT (necesario para Realtime)
CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_messages" ON kapso_messages
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_conversations" ON kapso_conversations
FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable realtime for kapso_contacts" ON kapso_contacts
FOR SELECT USING (true);
```

## Paso 6: Verificar Configuración

Ejecuta este SQL para verificar que todo esté configurado:

```sql
-- Verificar publicaciones
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('kapso_messages', 'kapso_conversations', 'kapso_contacts');
```

## Paso 7: Reiniciar la Aplicación

1. Detén el servidor (Ctrl+C)
2. Ejecuta: `npm run dev`
3. Abre el navegador en `http://localhost:3001`
4. Ve al chat y verifica los logs en la consola del navegador

## Logs Esperados

En la consola del navegador deberías ver:
```
📡 [useKapsoRealtime] Configurando Supabase Realtime...
✅ [useKapsoRealtime] Suscripción a mensajes activa
✅ [useKapsoRealtime] Suscripción a conversaciones activa
```

## Si No Funciona

1. Verifica que Realtime esté habilitado en el Dashboard
2. Comprueba que las tablas estén en la publicación
3. Verifica las políticas RLS
4. Revisa los logs del navegador para errores específicos
