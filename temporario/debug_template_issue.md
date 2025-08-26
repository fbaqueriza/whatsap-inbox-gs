# Debug: Problema con Template de Envío de Orden

## Problema Reportado
- Se envió una orden a "Proveedor 1" 
- Se envió como mensaje normal en lugar de usar el template `envio_de_orden`

## Análisis del Flujo

### 1. Flujo Correcto (Según el Código)
```
1. Usuario crea orden → handleCreateOrder()
2. Se llama OrderNotificationService.sendOrderNotification()
3. Se envía template via /api/whatsapp/trigger-conversation
4. Se guarda pedido pendiente
5. Se espera respuesta del proveedor
6. Se envían detalles automáticamente
```

### 2. Código Relevante

**OrderNotificationService.sendOrderNotification():**
```typescript
// PASO 1: Enviar template real de Meta
const triggerResponse = await fetch(`${baseUrl}/api/whatsapp/trigger-conversation`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: normalizedPhone,
    template_name: 'envio_de_orden'  // ← ESTE ES EL TEMPLATE QUE DEBERÍA USARSE
  }),
});
```

**trigger-conversation endpoint:**
```typescript
// Si se especifica un template, usar la API de templates
if (template_name) {
  const templatePayload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: template_name,
      language: {
        code: 'es_AR'
      }
    }
  };
  // Envía a Meta API
}
```

## Posibles Causas

### 1. **Error en la API de Meta**
- El template `envio_de_orden` no existe en Meta Business
- Error en la respuesta de Meta API
- Variables de entorno incorrectas

### 2. **Fallback a Mensaje Normal**
- Si el template falla, podría estar enviando un mensaje normal
- Error en el manejo de errores del template

### 3. **Problema en el Flujo**
- Se está llamando al endpoint incorrecto
- Se está pasando `message` en lugar de `template_name`

## Verificación Necesaria

### 1. **Revisar Logs de Vercel**
Buscar en los logs:
- `🚀 Disparando conversación de Meta`
- `❌ Error disparando template`
- `✅ Template disparado exitosamente`

### 2. **Verificar Template en Meta Business**
- Confirmar que el template `envio_de_orden` existe
- Verificar que esté aprobado y activo
- Confirmar el idioma `es_AR`

### 3. **Verificar Variables de Entorno**
- `WHATSAPP_API_KEY`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_URL`

## Solución Temporal

Si el template no funciona, el sistema debería:
1. Intentar enviar el template
2. Si falla, usar el fallback del TemplateService
3. Mostrar el contenido del template en el chat

## Próximos Pasos

1. **Revisar logs de Vercel** para ver qué error específico ocurrió
2. **Verificar en Meta Business** si el template existe
3. **Probar el template manualmente** via Meta API
4. **Implementar mejor manejo de errores** si es necesario
