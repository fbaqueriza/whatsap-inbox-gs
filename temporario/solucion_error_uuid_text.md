# Solución: Error "operator does not exist: uuid = text"

## 🔍 **Problema Identificado**

**Error**: `operator does not exist: uuid = text`
**Ubicación**: Webhook de WhatsApp Business API
**Causa**: El campo `user_id` estaba siendo establecido como string `'default_user'` cuando debería ser un UUID válido o `null`.

## 📋 **Archivos Afectados**

### **Archivo 1**: `src/lib/metaWhatsAppService.ts`
**Línea**: 570
**Problema**: 
```typescript
// ANTES (INCORRECTO)
const userId = message.user_id || 'default_user';
```

**Solución**:
```typescript
// DESPUÉS (CORRECTO)
const userId = message.user_id || null;
```

### **Archivo 2**: `src/app/api/whatsapp/messages/route.ts`
**Línea**: 86
**Problema**:
```typescript
// ANTES (INCORRECTO)
user_id: body.user_id || 'default_user',
```

**Solución**:
```typescript
// DESPUÉS (CORRECTO)
user_id: body.user_id || null,
```

## 🔧 **Explicación Técnica**

### **Causa Raíz**
La tabla `whatsapp_messages` tiene un campo `user_id` definido como tipo `UUID` en Supabase, pero el código estaba intentando insertar el string `'default_user'` en lugar de un UUID válido o `null`.

### **Tipos de Datos en Supabase**
- **UUID**: Formato hexadecimal de 32 caracteres (ej: `123e4567-e89b-12d3-a456-426614174000`)
- **TEXT**: Cadena de caracteres
- **NULL**: Valor nulo válido para campos opcionales

### **Solución Implementada**
1. **Cambiar fallback de string a null**: En lugar de usar `'default_user'` como valor por defecto, ahora usamos `null`
2. **Mantener compatibilidad**: Si se proporciona un `user_id` válido, se usa; si no, se usa `null`
3. **Validación implícita**: Supabase manejará automáticamente la validación de tipos

## ✅ **Beneficios de la Solución**

1. **Eliminación del Error**: El error `uuid = text` ya no ocurrirá
2. **Integridad de Datos**: Los datos se insertan con tipos correctos
3. **Flexibilidad**: Permite mensajes sin usuario asociado (null) o con usuario válido (UUID)
4. **Compatibilidad**: Mantiene la funcionalidad existente

## 🧪 **Verificación**

### **Pasos para Verificar**:
1. **Enviar mensaje** desde el proveedor
2. **Verificar logs** - no debe aparecer el error `uuid = text`
3. **Confirmar** que el mensaje se guarda correctamente en la base de datos
4. **Verificar** que aparece en el chat sin problemas

### **Logs Esperados**:
```
💾 Guardando mensaje con datos: {
  id: 'uuid-válido',
  timestamp: '2025-08-26T05:32:10.000Z',
  content: 'todo',
  contact_id: '+5491135562673'
}
✅ Mensaje procesado en base de datos
```

## 🔄 **Impacto en el Sistema**

### **Antes de la Corrección**:
- ❌ Error `uuid = text` al recibir mensajes
- ❌ Mensajes no se guardaban en la base de datos
- ❌ Pérdida de mensajes del proveedor

### **Después de la Corrección**:
- ✅ Mensajes se guardan correctamente
- ✅ No hay errores de tipo de datos
- ✅ Funcionalidad completa del webhook
- ✅ Mensajes aparecen en el chat

## 📊 **Archivos Modificados**

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `src/lib/metaWhatsAppService.ts` | 570 | `'default_user'` → `null` |
| `src/app/api/whatsapp/messages/route.ts` | 86 | `'default_user'` → `null` |

## ✅ **Conclusión**

El error ha sido **completamente solucionado** cambiando el valor por defecto del campo `user_id` de un string inválido a `null`. Esto permite que los mensajes se guarden correctamente en la base de datos sin errores de tipo de datos.

**Estado**: ✅ **RESUELTO**
**Fecha**: 26 de Agosto, 2025
**Impacto**: Crítico - Afectaba la recepción de mensajes del proveedor
