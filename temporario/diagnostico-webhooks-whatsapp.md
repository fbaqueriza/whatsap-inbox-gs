# Diagnóstico: Webhooks Vacíos y Template Disparador

## 🔍 Problemas Identificados

### 1. Webhooks Vacíos (Eventos procesados: 0)

**Síntomas:**
```
🔄 Procesando webhook de WhatsApp Business API
📡 Procesando cambio de campo: messages
✅ Webhook procesado exitosamente. Eventos procesados: 0
```

**Causas Posibles:**
- **Rate Limiting**: El servicio tiene un intervalo mínimo de 1 segundo entre procesamientos
- **Webhooks de Prueba**: Meta envía webhooks de prueba sin contenido real
- **Filtros Muy Estrictos**: Solo procesa mensajes de texto específicos
- **Configuración de Webhook**: El webhook puede no estar configurado correctamente en Meta

### 2. Template Disparador No Enviado

**Síntomas:**
- No se ven logs del envío del template `envio_de_orden` a Baron de la Menta
- El pedido se crea pero no se envía la notificación

**Causas Posibles:**
- **Variables de Entorno**: Configuración incorrecta de WhatsApp API
- **Template No Aprobado**: El template `envio_de_orden` puede no estar aprobado
- **Validación de Teléfono**: El número puede no cumplir el formato requerido
- **Errores Silenciosos**: Errores que no se están loggeando correctamente

## 🛠️ Soluciones Implementadas

### 1. Logging Mejorado para Webhooks

**Archivo:** `src/lib/webhookService.ts`

```typescript
// ✅ NUEVO: Logging detallado de la estructura del webhook
console.log('📊 Estructura del webhook:', {
  object: body.object,
  entryCount: body.entry?.length || 0,
  hasEntry: !!body.entry,
  entryTypes: body.entry?.map(e => ({
    id: e.id,
    changesCount: e.changes?.length || 0,
    changeFields: e.changes?.map(c => c.field) || []
  })) || []
});

// ✅ NUEVO: Análisis detallado de mensajes
for (const change of entry.changes) {
  console.log(`📡 Analizando cambio: ${change.field}`);
  
  if (change.field === 'messages') {
    const messageCount = change.value.messages?.length || 0;
    console.log(`📊 Mensajes encontrados en cambio:`, {
      count: messageCount,
      details: messageDetails
    });
  }
}
```

### 2. Logging Mejorado para Template Disparador

**Archivo:** `src/app/api/whatsapp/trigger-conversation/route.ts`

```typescript
// ✅ NUEVO: Logging detallado de la request
console.log('🚀 Trigger conversation request:', {
  to,
  template_name,
  hasMessage: !!message,
  hasTemplateParams: !!template_params,
  templateParamsCount: template_params?.length || 0
});

// ✅ NUEVO: Logging del payload enviado
console.log('📤 Enviando template a Meta API:', JSON.stringify(templatePayload, null, 2));

// ✅ NUEVO: Logging de la respuesta
console.log('📥 Respuesta de Meta API:', {
  status: response.status,
  statusText: response.statusText,
  result: result
});
```

### 3. Endpoint de Diagnóstico

**Archivo:** `src/app/api/whatsapp/status/route.ts` (NUEVO)

```typescript
// ✅ NUEVO: Endpoint para verificar configuración
GET /api/whatsapp/status

// Verifica:
// - Variables de entorno
// - Conectividad con Meta API
// - Información del número de teléfono
// - Templates disponibles
// - Estado de la cuenta de negocio
```

## 🔧 Pasos de Diagnóstico

### 1. Verificar Configuración de WhatsApp

```bash
# Acceder al endpoint de diagnóstico
curl https://tu-dominio.vercel.app/api/whatsapp/status
```

**Verificar:**
- ✅ Variables de entorno configuradas
- ✅ Conexión con Meta API exitosa
- ✅ Templates aprobados y disponibles
- ✅ Número de teléfono configurado correctamente

### 2. Verificar Webhook en Meta

**En Meta Developer Console:**
1. Ir a WhatsApp > Configuration
2. Verificar que el webhook URL esté configurado correctamente
3. Verificar que los campos estén suscritos:
   - `messages`
   - `message_template_status_update`
   - `message_template_quality_update`

### 3. Probar Template Disparador

```bash
# Probar envío de template
curl -X POST https://tu-dominio.vercel.app/api/whatsapp/trigger-conversation \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+5491140494130",
    "template_name": "envio_de_orden"
  }'
```

### 4. Verificar Logs en Vercel

**Buscar en los logs:**
- `🚀 Trigger conversation request`
- `📤 Enviando template a Meta API`
- `📥 Respuesta de Meta API`
- `✅ Template disparado exitosamente`

## 📊 Información de Debugging

### Logs Esperados para Webhook Funcional

```
🔄 Procesando webhook de WhatsApp Business API
📊 Estructura del webhook: { object: "whatsapp_business_account", entryCount: 1 }
📡 Analizando cambio: messages
📊 Mensajes encontrados en cambio: { count: 1, details: [...] }
💬 Procesando mensaje de +5491140494130: Hola...
✅ Procesados 1 mensajes
✅ Webhook procesado exitosamente. Eventos procesados: 1
```

### Logs Esperados para Template Disparador

```
🚀 Trigger conversation request: { to: "+5491140494130", template_name: "envio_de_orden" }
📤 Enviando template a Meta API: { messaging_product: "whatsapp", ... }
📥 Respuesta de Meta API: { status: 200, result: { messages: [...] } }
✅ Template disparado exitosamente
✅ Template guardado en base de datos
```

## 🎯 Próximos Pasos

1. **Ejecutar diagnóstico** usando el endpoint `/api/whatsapp/status`
2. **Verificar configuración** en Meta Developer Console
3. **Probar template disparador** con el comando curl
4. **Revisar logs** en Vercel para identificar errores específicos
5. **Corregir configuración** basándose en los resultados del diagnóstico

## 📈 Métricas de Monitoreo

- **Webhooks recibidos**: Contar webhooks con eventos > 0
- **Templates enviados**: Contar templates exitosos vs fallidos
- **Tiempo de respuesta**: Medir latencia de Meta API
- **Errores de configuración**: Monitorear variables de entorno
