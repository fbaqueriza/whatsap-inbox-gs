# 🔧 Configurar Webhook de WhatsApp Business API

## Problema Identificado
Los documentos llegan a la plataforma pero NO aparecen en el chat porque el webhook no está configurado correctamente.

## Pasos para Configurar el Webhook

### 1. Acceder a WhatsApp Business Manager
1. Ve a [Facebook Business Manager](https://business.facebook.com/)
2. Selecciona tu cuenta de negocio
3. Ve a "WhatsApp Business API" o "WhatsApp Manager"

### 2. Configurar el Webhook
1. Ve a la sección "Webhooks"
2. Haz clic en "Configurar webhook"
3. Ingresa la URL del webhook: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
4. **Token de verificación**: `tu-token-de-verificacion` (debe coincidir con `WHATSAPP_VERIFY_TOKEN` en tu .env)

### 3. Suscribirse a Eventos
Asegúrate de estar suscrito a estos eventos:
- ✅ `messages` (mensajes recibidos)
- ✅ `message_deliveries` (confirmaciones de entrega)
- ✅ `message_reads` (confirmaciones de lectura)

### 4. Verificar la Configuración
1. Haz clic en "Verificar webhook"
2. Deberías ver un mensaje de éxito
3. Envía un mensaje de prueba desde WhatsApp

## Para Desarrollo Local (ngrok)

Si estás desarrollando localmente:

### 1. Instalar ngrok
```bash
npm install -g ngrok
```

### 2. Exponer el puerto local
```bash
ngrok http 3001
```

### 3. Usar la URL de ngrok
- URL del webhook: `https://tu-id-ngrok.ngrok.io/api/whatsapp/webhook`
- Ejemplo: `https://abc123.ngrok.io/api/whatsapp/webhook`

## Verificación

Después de configurar el webhook:
1. Envía un mensaje desde WhatsApp
2. Deberías ver logs en la terminal del servidor
3. Los documentos deberían aparecer en el chat

## Troubleshooting

### Si no ves logs del webhook:
1. Verifica que la URL del webhook sea correcta
2. Verifica que el token de verificación coincida
3. Verifica que estés suscrito a los eventos correctos
4. Verifica que ngrok esté funcionando (si usas desarrollo local)

### Si ves errores 403:
- Normal para GET requests
- El webhook solo acepta POST requests de WhatsApp

### Si los mensajes llegan pero no los documentos:
- Verifica que estés suscrito al evento `messages`
- Verifica que el webhook esté procesando correctamente los mensajes con archivos
