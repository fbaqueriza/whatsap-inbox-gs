# Test del Webhook de WhatsApp

## Problema Identificado
Los documentos enviados por el proveedor NO aparecen en el chat porque no se están guardando como mensajes en `whatsapp_messages` con `media_url`.

## Verificación Necesaria

### 1. Envía un documento desde el proveedor
- Número: `+5491135562673`
- Envía cualquier documento (PDF, imagen, etc.)

### 2. Revisa los logs del terminal del servidor
Busca estos logs específicos:

```
📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
📨 [webhook_xxx] MENSAJES ENCONTRADOS: 1
📨 [webhook_xxx] Mensaje 1: { type: 'document', hasDocument: true }
📱 [webhook_xxx] Insertando mensaje de documento: { ... }
✅ [webhook_xxx] Mensaje de documento guardado en chat
```

### 3. Diagnóstico

**Si NO ves logs del webhook:**
- El webhook no está configurado en WhatsApp Business Manager
- El webhook apunta a una URL incorrecta
- El documento no se está enviando realmente

**Si ves logs pero hay error:**
- Error en la estructura de la tabla `whatsapp_messages`
- Error en la inserción de datos
- Error en el procesamiento del documento

**Si todo funciona pero no aparece en el chat:**
- Error en el frontend o en la API de mensajes
- Problema de sincronización

## Próximos Pasos
1. Enviar documento y revisar logs
2. Reportar qué logs aparecen (o no aparecen)
3. Corregir el problema identificado
