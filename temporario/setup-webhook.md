# 🚀 Configuración del Webhook con ngrok

## ✅ Estado Actual
- ✅ Webhook funciona correctamente (test manual exitoso)
- ✅ Servidor corriendo en puerto 3001
- ❌ WhatsApp Business Manager no está enviando mensajes al webhook

## 🛠️ Solución: Configurar ngrok

### Paso 1: Instalar ngrok
```bash
# Opción A: Usando npm (si tienes Node.js)
npm install -g ngrok

# Opción B: Descargar desde https://ngrok.com/download
```

### Paso 2: Exponer el servidor local
```bash
# En una nueva terminal, ejecutar:
ngrok http 3001
```

### Paso 3: Obtener la URL de ngrok
Después de ejecutar ngrok, verás algo como:
```
Forwarding    https://abc123def456.ngrok.io -> http://localhost:3001
```

### Paso 4: Configurar en WhatsApp Business Manager
1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación de WhatsApp Business
3. Ve a **WhatsApp > Configuration**
4. En **Webhook**, haz clic en **Configure**
5. Ingresa:
   - **Callback URL**: `https://abc123def456.ngrok.io/api/whatsapp/webhook`
   - **Verify Token**: El valor de `WHATSAPP_VERIFY_TOKEN` de tu `.env.local`
6. Haz clic en **Verify and Save**
7. En **Webhook Fields**, selecciona:
   - ✅ `messages`
   - ✅ `message_deliveries`
8. Haz clic en **Subscribe**

## 🧪 Verificación
1. Mantén ngrok corriendo
2. Envía un mensaje desde el número del proveedor
3. Deberías ver en el terminal del servidor:
   ```
   📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
   📨 [webhook_xxx] MENSAJES ENCONTRADOS: 1
   ```

## 🔄 Alternativa: Usar Vercel
Si prefieres no usar ngrok, puedes:
1. Hacer deploy a Vercel
2. Usar la URL de Vercel en WhatsApp Business Manager
3. Ejemplo: `https://tu-app.vercel.app/api/whatsapp/webhook`

## 📋 Variables de Entorno Necesarias
Asegúrate de que tu `.env.local` tenga:
```env
WHATSAPP_VERIFY_TOKEN=tu_verify_token_aqui
WHATSAPP_ACCESS_TOKEN=tu_access_token_aqui
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id_aqui
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_business_account_id_aqui
```
