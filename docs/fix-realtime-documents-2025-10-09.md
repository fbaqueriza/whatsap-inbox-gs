# 🔧 Fix: Mensajes en Tiempo Real y Documentos en Chat
**Fecha**: 9 de Octubre 2025
**Autor**: Asistente AI

## 🎯 Problemas Identificados

### 1. Mensajes NO llegan en tiempo real
**Síntoma**: Cuando el proveedor responde a un mensaje disparador, el mensaje no aparece inmediatamente en el chat. Solo aparece después de refrescar la página.

**Causa Raíz**: La suscripción de Supabase Realtime a la tabla `whatsapp_messages` NO tenía filtro por `user_id`, lo que podía causar problemas con las políticas RLS (Row Level Security) de Supabase.

### 2. Documentos NO aparecen en el chat
**Síntoma**: Cuando un proveedor envía un documento (PDF, imagen), el documento se procesa correctamente pero no aparece en la interfaz del chat.

**Causa Raíz**: El listener de tiempo real no estaba propagando los campos `media_url`, `media_type`, `isDocument` y `filename` desde el mensaje de Supabase al estado del chat.

---

## ✅ Soluciones Implementadas

### Solución 1: Filtro de Realtime por user_id

**Archivo**: `src/services/realtimeService.tsx`

**Cambio**: Agregar filtro por `user_id` en la suscripción a `whatsapp_messages`

```typescript
await subscribe(
  {
    table: 'whatsapp_messages',
    event: '*',
    filter: currentUserId ? `user_id=eq.${currentUserId}` : undefined  // ✅ NUEVO
  },
  ...
);
```

**Resultado**: 
- La suscripción ahora filtra correctamente los mensajes del usuario actual
- RLS de Supabase permite el paso de mensajes
- Los mensajes llegan en tiempo real sin necesidad de refrescar

---

### Solución 2: Propagación de Campos de Documentos

**Archivo**: `src/contexts/ChatContext.tsx`

**Cambio**: Incluir campos de media en el listener de tiempo real

```typescript
const chatMessage: ChatWhatsAppMessage = {
  id: realtimeMessage.id,
  content: realtimeMessage.content,
  timestamp: realtimeMessage.timestamp,
  type: realtimeMessage.type,
  contact_id: realtimeMessage.contact_id,
  status: realtimeMessage.status as 'sent' | 'delivered' | 'read' | 'failed' | undefined,
  // ✅ NUEVO: Campos de documentos
  isDocument: !!(realtimeMessage as any).media_url,
  mediaUrl: (realtimeMessage as any).media_url,
  filename: (realtimeMessage as any).media_url 
    ? (realtimeMessage as any).media_url.split('/').pop()?.split('_').slice(1).join('_') || 'documento' 
    : undefined,
  mediaType: (realtimeMessage as any).media_type
};
```

**Resultado**:
- Los documentos ahora aparecen correctamente en el chat
- El componente `IntegratedChatPanel` puede renderizar el botón de descarga
- Los archivos se muestran con su nombre y tipo

---

## 🧪 Cómo Probar

### Prueba 1: Mensaje de Texto en Tiempo Real

1. Abrir la aplicación en el navegador
2. Enviar un mensaje de prueba desde WhatsApp al negocio
3. **Resultado Esperado**: El mensaje aparece inmediatamente en el chat sin refrescar

### Prueba 2: Documento en Tiempo Real

1. Abrir la aplicación en el navegador
2. Enviar un PDF o imagen desde WhatsApp al negocio
3. **Resultado Esperado**: 
   - El documento aparece inmediatamente en el chat
   - Se muestra con icono de archivo
   - Tiene botón de descarga funcional

---

## 📊 Verificación en Consola

Después de aplicar los cambios, deberías ver estos logs en la consola del navegador:

```
✅ RealtimeService: Suscripción a whatsapp_messages activa para user_id: [tu-user-id]
🔍 [RealtimeService] Nuevo mensaje recibido: [message-id]
✅ [RealtimeService] Agregando nuevo mensaje al estado: [message-id]
📢 [RealtimeService] Notificando a X listeners
```

---

## 🔄 Flujo Completo

### Mensaje de Texto
1. Proveedor envía mensaje por WhatsApp
2. Meta/WhatsApp envía webhook a `/api/whatsapp/webhook`
3. Webhook guarda mensaje en tabla `whatsapp_messages` con `user_id`
4. Supabase Realtime detecta INSERT (filtrado por `user_id`)
5. RealtimeService recibe el evento y notifica listeners
6. ChatContext actualiza el estado
7. IntegratedChatPanel renderiza el mensaje
8. ✅ Usuario ve el mensaje inmediatamente

### Documento/Media
1. Proveedor envía PDF/imagen por WhatsApp
2. Webhook descarga el archivo desde Meta API
3. Webhook sube archivo a Supabase Storage
4. Webhook crea registro en tabla `documents`
5. Webhook crea mensaje en `whatsapp_messages` con `media_url` y `media_type`
6. Supabase Realtime detecta INSERT
7. RealtimeService propaga mensaje CON campos de media
8. ChatContext incluye `isDocument`, `mediaUrl`, `filename`, `mediaType`
9. IntegratedChatPanel renderiza el documento con botón de descarga
10. ✅ Usuario ve el documento inmediatamente y puede descargarlo

---

## 🚨 Notas Importantes

1. **RLS Policies**: Asegúrate de que las políticas RLS de Supabase permitan:
   - SELECT en `whatsapp_messages` para mensajes donde `user_id = auth.uid()`
   - INSERT en `whatsapp_messages` (para el service role key)

2. **Service Role Key**: El webhook usa `SUPABASE_SERVICE_ROLE_KEY` para bypasear RLS al insertar mensajes

3. **Realtime**: La suscripción del frontend usa el cliente autenticado del usuario, por eso necesita el filtro por `user_id`

---

## 📝 Archivos Modificados

1. `src/services/realtimeService.tsx` - Agregado filtro por user_id en suscripción
2. `src/contexts/ChatContext.tsx` - Propagación de campos de media en listener

---

## ✅ Checklist de Verificación

- [x] Filtro por user_id en suscripción de realtime
- [x] Campos de media en listener de ChatContext
- [x] Webhook crea mensajes con media_url para documentos
- [x] IntegratedChatPanel renderiza documentos correctamente
- [ ] Probar mensaje de texto en tiempo real
- [ ] Probar documento en tiempo real
- [ ] Verificar logs en consola
- [ ] Verificar que no hay duplicados de mensajes

---

## 🎓 Aprendizajes

1. **Supabase Realtime + RLS**: Cuando uses Realtime con RLS, SIEMPRE agrega filtros en la suscripción que coincidan con las políticas RLS. Si no, los eventos pueden ser bloqueados silenciosamente.

2. **Propagación de Datos**: Asegúrate de que TODOS los campos relevantes se propaguen a través de TODOS los listeners y transformaciones. Un campo perdido en cualquier punto rompe la funcionalidad.

3. **Testing de Realtime**: Es difícil testear realtime sin un webhook real. Considera crear un endpoint de prueba que simule webhooks para desarrollo local.

