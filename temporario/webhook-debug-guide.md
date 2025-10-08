# 🔧 Guía de Debug del Webhook de WhatsApp

## 🚨 Problema Identificado
Los mensajes del proveedor no están llegando al sistema, lo que indica que el webhook no está configurado correctamente o no está funcionando.

## 📋 Pasos para Verificar y Corregir

### 1. **Verificar Configuración del Webhook en WhatsApp Business Manager**

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. Ve a **WhatsApp > Configuration**
4. En la sección **Webhook**, verifica que:
   - **Callback URL**: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
   - **Verify Token**: Debe coincidir con `WHATSAPP_VERIFY_TOKEN` en tu `.env`
   - **Webhook Fields**: Debe incluir `messages` y `message_deliveries`

### 2. **Verificar Variables de Entorno**

Asegúrate de que estas variables estén configuradas en tu `.env.local`:

```env
WHATSAPP_VERIFY_TOKEN=tu_verify_token_aqui
WHATSAPP_ACCESS_TOKEN=tu_access_token_aqui
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id_aqui
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_business_account_id_aqui
```

### 3. **Probar el Webhook**

#### Opción A: Usando ngrok (para desarrollo local)
```bash
# Instalar ngrok si no lo tienes
npm install -g ngrok

# Exponer tu servidor local
ngrok http 3001

# Usar la URL de ngrok en WhatsApp Business Manager
# Ejemplo: https://abc123.ngrok.io/api/whatsapp/webhook
```

#### Opción B: Verificar en Vercel (para producción)
- Asegúrate de que la URL del webhook en WhatsApp Business Manager apunte a tu dominio de Vercel
- Ejemplo: `https://tu-app.vercel.app/api/whatsapp/webhook`

### 4. **Verificar Logs del Webhook**

Para verificar si el webhook está recibiendo datos:

1. **En desarrollo local**: Revisa la consola del terminal donde corre el servidor
2. **En Vercel**: Ve a la pestaña "Functions" en tu dashboard de Vercel y revisa los logs

### 5. **Test Manual del Webhook**

Puedes probar el webhook manualmente:

```bash
# GET request (verificación)
curl "https://tu-dominio.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tu_verify_token&hub.challenge=test123"

# POST request (simular mensaje)
curl -X POST "https://tu-dominio.vercel.app/api/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "messages": [{
            "from": "5491135562673",
            "id": "test_message_id",
            "timestamp": "1640995200",
            "text": {
              "body": "Test message"
            },
            "type": "text"
          }]
        }
      }]
    }]
  }'
```

### 6. **Verificar Permisos de la Aplicación**

En Facebook Developers, asegúrate de que tu aplicación tenga los permisos necesarios:
- `whatsapp_business_messaging`
- `whatsapp_business_management`

### 7. **Verificar Número de Teléfono**

Asegúrate de que el número de teléfono del proveedor esté configurado correctamente en WhatsApp Business Manager y que tenga permisos para enviar mensajes.

## 🔍 Debug Adicional

### Verificar en la Consola del Navegador
Ahora los logs de debug mostrarán el contenido completo de los mensajes. Revisa la consola cuando selecciones el contacto "La Mielisima" para ver:
- Si hay mensajes del proveedor
- Cuál es el timestamp del último mensaje
- Si la lógica de 24 horas está funcionando correctamente

### Verificar en la Base de Datos
Puedes verificar directamente en Supabase si los mensajes del proveedor se están guardando:
```sql
SELECT * FROM whatsapp_messages 
WHERE contact_id = '+5491135562673' 
AND message_type = 'received' 
ORDER BY created_at DESC;
```

## 🎯 Próximos Pasos

1. **Configurar el webhook correctamente** siguiendo los pasos arriba
2. **Enviar un mensaje de prueba** desde el número del proveedor
3. **Verificar que aparezca en los logs** del webhook
4. **Confirmar que se guarde en la base de datos**
5. **Verificar que se muestre en el chat** y desbloquee la ventana de 24 horas

## 📞 Contacto de Soporte

Si el problema persiste, puede ser necesario:
- Contactar a Meta Business Support
- Verificar la configuración de la cuenta de WhatsApp Business
- Revisar los límites de la API de WhatsApp
