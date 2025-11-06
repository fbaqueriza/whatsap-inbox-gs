# 🔍 Diagnóstico: Documentos de WhatsApp no se registran

**Fecha**: 2025-01-XX  
**Problema**: Los documentos que entran por WhatsApp no se están registrando en el sistema

## 📋 Problema Identificado

Cuando un documento (PDF, imagen, etc.) llegaba por WhatsApp, el sistema:

1. **Buscaba el proveedor** usando el número de teléfono del remitente
2. **Si no encontraba el proveedor exacto**, el proceso **fallaba completamente** y **NO registraba el documento**
3. **No había búsqueda flexible** para manejar variaciones en el formato del número de teléfono

### Causa Raíz

El código en `src/app/api/whatsapp/webhook/route.ts` tenía una búsqueda muy estricta:

```typescript
const { data: provider } = await supabase
  .from('providers')
  .select('user_id, id, name, auto_order_flow_enabled')
  .eq('phone', normalizedFrom)
  .single();

if (!provider) {
  return { success: false, error: 'Proveedor no encontrado' };
  // ❌ El documento nunca se procesa
}
```

### Problemas Específicos

1. **Formato de número inconsistente**: 
   - WhatsApp puede enviar números con formato `+5411123456789`
   - La BD puede tener `5411123456789` o `+5411123456789` o `11123456789`
   - La búsqueda exacta falla si no coincide exactamente

2. **Falta de fallback**:
   - Si no se encuentra el proveedor, el documento se descarta completamente
   - No hay intento de procesar el documento sin proveedor
   - No hay recuperación posterior (asociar proveedor después de procesar OCR)

3. **Logging insuficiente**:
   - No había suficiente información de debug para identificar por qué no se encontraba el proveedor

## ✅ Solución Implementada

### 1. Búsqueda Flexible del Proveedor

Ahora el sistema intenta múltiples estrategias de búsqueda:

```typescript
// 1. Búsqueda exacta
const { data: exactProvider } = await supabase
  .from('providers')
  .select('user_id, id, name, auto_order_flow_enabled')
  .eq('phone', normalizedFrom)
  .single();

// 2. Si falla, probar variantes del número
const phoneVariants = [
  normalizedFrom,                    // Original
  normalizedFrom.replace(/^\+54/, ''), // Sin código de país
  normalizedFrom.replace(/^\+/, ''),   // Sin +
  `54${normalizedFrom.replace(/^\+54/, '')}`, // Con 54 al inicio
  normalizedFrom.replace(/\D/g, ''),   // Solo dígitos
];

// 3. Si aún falla, búsqueda por últimos 8 dígitos
const lastDigits = normalizedFrom.replace(/\D/g, '').slice(-8);
// Búsqueda flexible con ILIKE
```

### 2. Procesamiento sin Proveedor (Fallback)

Si no se encuentra el proveedor, **ahora el sistema aún procesa el documento**:

- ✅ Descarga el archivo desde WhatsApp
- ✅ Sube el archivo a Supabase Storage
- ✅ Crea el documento en la BD (sin `provider_id` inicialmente)
- ✅ Procesa con OCR (puede ayudar a encontrar el proveedor después)
- ✅ Crea mensaje en el chat si encuentra `user_id`
- ✅ Intenta asociar proveedor después del procesamiento OCR

### 3. Mejor Logging

Agregado logging detallado en cada paso:
- ✅ Qué variante de número se está probando
- ✅ Si se encuentra el proveedor y con qué método
- ✅ Si se procesa sin proveedor y por qué
- ✅ Errores específicos en cada paso

## 🔧 Cambios Realizados

### Archivo: `src/app/api/whatsapp/webhook/route.ts`

1. **Mejora en búsqueda de proveedor** (función `processWhatsAppMessage`):
   - Búsqueda exacta
   - Búsqueda con variantes
   - Búsqueda flexible por últimos dígitos
   - Fallback a procesamiento sin proveedor

2. **Nueva función**: `processWhatsAppDocumentWithoutProvider`:
   - Procesa documentos cuando no se encuentra el proveedor
   - Busca `user_id` de manera flexible
   - Crea documento y mensaje en el chat
   - Procesa con OCR para intentar asociación posterior

## 📊 Flujo Mejorado

```
Documento llega por WhatsApp
    ↓
Normalizar número de teléfono
    ↓
Buscar proveedor (exacto)
    ↓ (si falla)
Buscar proveedor (variantes)
    ↓ (si falla)
Buscar proveedor (últimos 8 dígitos)
    ↓ (si falla)
✅ PROCESAR DOCUMENTO SIN PROVEEDOR
    ↓
    - Descargar archivo
    - Subir a Storage
    - Crear documento en BD
    - Procesar OCR
    - Crear mensaje en chat (si user_id encontrado)
    - Intentar asociar proveedor después (por CUIT, etc.)
```

## 🧪 Cómo Verificar la Solución

### 1. Verificar Logs

Cuando llegue un documento por WhatsApp, revisar los logs del servidor:

```bash
# Buscar en los logs:
✅ [requestId] Proveedor encontrado con búsqueda exacta
✅ [requestId] Proveedor encontrado con variante X
✅ [requestId] Proveedor encontrado con búsqueda flexible
⚠️ [requestId] PROCESANDO DOCUMENTO SIN PROVEEDOR
✅ [requestId] Documento procesado sin proveedor: [document_id]
```

### 2. Verificar en Base de Datos

```sql
-- Ver documentos recientes
SELECT 
  id,
  filename,
  sender_phone,
  provider_id,
  user_id,
  created_at,
  status
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- Ver documentos sin proveedor (deberían procesarse ahora)
SELECT 
  id,
  filename,
  sender_phone,
  provider_id,
  user_id
FROM documents
WHERE provider_id IS NULL
  AND sender_phone IS NOT NULL
ORDER BY created_at DESC;
```

### 3. Verificar en el Chat

Los documentos deberían aparecer en el chat de WhatsApp incluso si no se encuentra el proveedor inicialmente.

## 🚨 Casos a Considerar

### Caso 1: Número no está en la BD
- ✅ **Antes**: Documento se descartaba
- ✅ **Ahora**: Documento se procesa, se intenta asociar después

### Caso 2: Formato de número diferente
- ✅ **Antes**: Fallaba si no coincidía exactamente
- ✅ **Ahora**: Intenta múltiples formatos automáticamente

### Caso 3: Proveedor encontrado después del OCR
- ✅ El OCR puede extraer el CUIT del proveedor
- ✅ El sistema intenta asociar el documento al proveedor por CUIT
- ✅ Se puede ejecutar manualmente: `/api/whatsapp/auto-sync-documents`

## 📝 Próximos Pasos Recomendados

1. **Monitorear documentos sin proveedor**:
   - Revisar periódicamente documentos con `provider_id IS NULL`
   - Usar el endpoint `/api/whatsapp/auto-sync-documents` para intentar asociar

2. **Normalizar números en la BD**:
   - Asegurar que todos los números de teléfono en la tabla `providers` estén normalizados
   - Considerar agregar índice para búsquedas más rápidas

3. **Mejorar asociación posterior**:
   - Implementar proceso automático que intente asociar documentos sin proveedor
   - Usar datos del OCR (CUIT, nombre) para encontrar el proveedor

4. **Alertas**:
   - Considerar alertar cuando hay documentos sin proveedor por más de X días

## 🔗 Referencias

- Archivo modificado: `src/app/api/whatsapp/webhook/route.ts`
- Endpoint de sincronización: `/api/whatsapp/auto-sync-documents`
- Servicio de documentos: `src/lib/documentService.ts`

---

**Estado**: ✅ Solucionado  
**Impacto**: Los documentos de WhatsApp ahora se registran incluso si no se encuentra el proveedor inicialmente
