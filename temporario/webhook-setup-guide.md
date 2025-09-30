# 🔧 Guía para Configurar Webhook de WhatsApp

## 📋 **Paso 1: Verificar Variables de Entorno**

Asegúrate de tener estas variables en tu `.env.local`:

```env
WHATSAPP_VERIFY_TOKEN=tu_verify_token_aqui
WHATSAPP_API_KEY=tu_access_token_aqui
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## 📋 **Paso 2: Configurar Webhook en Meta Developer Console**

1. **Ve a [Facebook Developers](https://developers.facebook.com/)**
2. **Selecciona tu app de WhatsApp Business**
3. **Ve a WhatsApp > Configuration**
4. **En la sección "Webhook":**
   - **Callback URL**: `https://tu-dominio.vercel.app/api/whatsapp/webhook`
   - **Verify Token**: `tu_verify_token_aqui` (el mismo que en .env.local)
   - **Webhook Fields**: Marca estas opciones:
     - ✅ `messages` (para recibir mensajes)
     - ✅ `message_deliveries` (para confirmaciones de entrega)
     - ✅ `message_reads` (para confirmaciones de lectura)

## 📋 **Paso 3: Verificar que el Webhook Funciona**

### 3.1. **Verificar GET (Verificación):**
```bash
curl "https://tu-dominio.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tu_verify_token_aqui&hub.challenge=test123"
```

**Respuesta esperada:** `test123`

### 3.2. **Verificar POST (Recibir mensajes):**
```bash
curl -X POST "https://tu-dominio.vercel.app/api/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"from":"5491140494130","text":{"body":"Hola"}}]}}]}]}'
```

**Respuesta esperada:** `{"status":"ok","processed":true}`

## 📋 **Paso 4: Probar con Mensaje Real**

1. **Envía un mensaje desde WhatsApp** a tu número de business
2. **Revisa los logs** en Vercel Dashboard > Functions
3. **Verifica en la app** que el mensaje aparece en el chat

## 🔍 **Debugging**

### Si no llegan mensajes:

1. **Verifica la URL del webhook** en Meta Developer Console
2. **Revisa los logs** en Vercel Dashboard
3. **Verifica las variables de entorno** en Vercel
4. **Confirma que el número de teléfono** está registrado en la tabla `providers`

### Logs esperados en el webhook:
```
📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
📨 [webhook_xxx] Procesando 1 mensajes
✅ [webhook_xxx] Mensaje procesado exitosamente
```

## 🚨 **Problemas Comunes**

### 1. **Error 403 en verificación:**
- Verifica que el `WHATSAPP_VERIFY_TOKEN` coincida
- Asegúrate de que la URL sea exacta

### 2. **No llegan mensajes:**
- Verifica que el webhook esté suscrito a `messages`
- Revisa que el número esté en la tabla `providers`
- Confirma que las variables de entorno estén correctas

### 3. **Mensajes no aparecen en la app:**
- Verifica que `SUPABASE_SERVICE_ROLE_KEY` sea correcta
- Revisa los logs del webhook para errores
- Confirma que el `user_id` del proveedor sea correcto

## ✅ **Checklist Final**

- [ ] App desplegada en Vercel
- [ ] Variables de entorno configuradas en Vercel
- [ ] Webhook configurado en Meta Developer Console
- [ ] Verificación GET funciona
- [ ] Mensaje de prueba enviado
- [ ] Mensaje aparece en la app
- [ ] Logs del webhook sin errores
