# 📱 Configuración de WhatsApp Business API

## 🔧 Variables de Entorno Requeridas

Agregar al archivo `.env.local`:

```env
# WhatsApp Business API Configuration
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token_here
```

## 🚀 Pasos para Configurar WhatsApp Business API

### 1. Crear Aplicación en Meta Developer Console
1. Ir a [Meta Developer Console](https://developers.facebook.com/)
2. Crear nueva aplicación
3. Agregar producto "WhatsApp Business API"
4. Configurar número de teléfono empresarial

### 2. Obtener Credenciales
- **Phone Number ID**: En la configuración del número de teléfono
- **Access Token**: Token permanente de la aplicación
- **Verify Token**: Token personalizado para verificar webhooks

### 3. Configurar Webhook
1. En Meta Developer Console, ir a Webhooks
2. URL del webhook: `https://tu-dominio.com/api/whatsapp/webhook`
3. Verify Token: El mismo que configuraste en `.env.local`
4. Suscribirse a eventos: `messages`

### 4. Crear Template de Mensaje
1. En WhatsApp Business Manager
2. Crear template: `envio_de_orden`
3. Idioma: Español
4. Categoría: Marketing
5. Contenido: Mensaje personalizado para envío de órdenes

## 🔍 Verificación

### 1. Probar Webhook
```bash
curl -X GET "https://tu-dominio.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tu_token&hub.challenge=test"
```

### 2. Probar Envío de Mensaje
```bash
curl -X POST "https://tu-dominio.com/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{"to":"+5491135562673","message":"envio_de_orden"}'
```

## 📊 Monitoreo

### Logs a Verificar
- ✅ Webhook verificado exitosamente
- 📤 Enviando mensaje real a Meta API
- ✅ Mensaje enviado exitosamente
- 📥 Webhook recibido
- ✅ Respuesta del proveedor procesada exitosamente

## 🛠️ Solución de Problemas

### Error: "Configuración de WhatsApp incompleta"
- Verificar que todas las variables de entorno estén configuradas
- Revisar que los valores sean correctos

### Error: "Error de Meta API"
- Verificar que el Access Token sea válido
- Confirmar que el Phone Number ID sea correcto
- Revisar que el template esté aprobado

### Webhook no recibe mensajes
- Verificar que la URL del webhook sea accesible públicamente
- Confirmar que el Verify Token coincida
- Revisar logs de Meta Developer Console
