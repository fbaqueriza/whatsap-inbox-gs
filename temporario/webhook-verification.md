# 🔧 Verificación del Webhook de WhatsApp

## 🚨 Problema Identificado
El proveedor envió una factura pero:
- ❌ No aparece en el chat
- ❌ No se asocia a la orden correspondiente
- ❌ No hay logs del webhook recibiendo el mensaje

## 📋 Diagnóstico

### 1. **Estado Actual del Webhook**
- ✅ El webhook está implementado correctamente en el código
- ❌ No se están recibiendo mensajes del proveedor
- ❌ No hay logs de `📥 WEBHOOK RECIBIDO` en el terminal

### 2. **Posibles Causas**
1. **Webhook no configurado en WhatsApp Business Manager**
2. **URL del webhook incorrecta o inaccesible**
3. **Permisos insuficientes del webhook**
4. **Problema de conectividad (ngrok/localhost)**

## 🛠️ Soluciones

### Opción A: Configurar ngrok para desarrollo local
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer el servidor local
ngrok http 3001

# Usar la URL de ngrok en WhatsApp Business Manager
# Ejemplo: https://abc123.ngrok.io/api/whatsapp/webhook
```

### Opción B: Configurar webhook en Vercel (producción)
1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación
3. Ve a **WhatsApp > Configuration**
4. Configura el webhook:
   - **Callback URL**: `https://tu-app.vercel.app/api/whatsapp/webhook`
   - **Verify Token**: Usa el mismo valor que `WHATSAPP_VERIFY_TOKEN`
   - **Webhook Fields**: Selecciona `messages` y `message_deliveries`

### Opción C: Verificar configuración actual
1. Verifica que `WHATSAPP_VERIFY_TOKEN` esté configurado en `.env.local`
2. Verifica que la URL del webhook en WhatsApp Business Manager sea correcta
3. Verifica que el webhook tenga permisos para recibir mensajes

## 🧪 Test del Webhook

### Test Manual (POST request)
```bash
curl -X POST "http://localhost:3001/api/whatsapp/webhook" \
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
              "body": "Test message from provider"
            },
            "type": "text"
          }]
        }
      }]
    }]
  }'
```

### Verificar en Logs
Después del test, deberías ver en el terminal:
```
📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
📨 [webhook_xxx] MENSAJES ENCONTRADOS: 1
```

## 🎯 Próximos Pasos

1. **Configurar ngrok** para exponer el servidor local
2. **Actualizar el webhook** en WhatsApp Business Manager con la URL de ngrok
3. **Probar enviando un mensaje** desde el número del proveedor
4. **Verificar que aparezca** en los logs del terminal
5. **Confirmar que se guarde** en la base de datos y aparezca en el chat

## 📞 Configuración del Webhook en WhatsApp Business Manager

### Pasos detallados:
1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación de WhatsApp Business
3. En el menú lateral, ve a **WhatsApp > Configuration**
4. En la sección **Webhook**, haz clic en **Configure**
5. Ingresa:
   - **Callback URL**: `https://tu-ngrok-url.ngrok.io/api/whatsapp/webhook`
   - **Verify Token**: El valor de `WHATSAPP_VERIFY_TOKEN` de tu `.env.local`
6. Haz clic en **Verify and Save**
7. En **Webhook Fields**, selecciona:
   - ✅ `messages`
   - ✅ `message_deliveries`
8. Haz clic en **Subscribe**

### Verificación:
- Deberías ver un checkmark verde junto a "Webhook"
- El estado debería mostrar "Active"
