# 🔧 Configuración del Webhook de Vercel

## ✅ Estado Actual
- ✅ Webhook funciona correctamente (test manual exitoso)
- ✅ Servidor funcionando en Vercel
- ❌ WhatsApp Business Manager no está enviando mensajes del proveedor al webhook

## 🚨 Problema Identificado
Según los logs del terminal, el webhook está funcionando correctamente cuando se hace un test manual, pero **no está recibiendo mensajes reales del proveedor**.

## 🛠️ Solución: Verificar Configuración en WhatsApp Business Manager

### Paso 1: Verificar URL del Webhook
1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Selecciona tu aplicación de WhatsApp Business
3. Ve a **WhatsApp > Configuration**
4. Verifica que el **Callback URL** sea:
   ```
   https://tu-app.vercel.app/api/whatsapp/webhook
   ```
   (Reemplaza `tu-app` con el nombre real de tu aplicación en Vercel)

### Paso 2: Verificar Verify Token
1. En la misma sección de **Webhook**
2. Verifica que el **Verify Token** coincida exactamente con el valor de `WHATSAPP_VERIFY_TOKEN` en tu archivo `.env.local`
3. Si no coincide, actualiza el valor en WhatsApp Business Manager

### Paso 3: Verificar Webhook Fields
1. En la sección **Webhook Fields**, asegúrate de que estén seleccionados:
   - ✅ `messages`
   - ✅ `message_deliveries`
2. Si no están seleccionados, selecciónalos y haz clic en **Subscribe**

### Paso 4: Verificar Estado del Webhook
1. El webhook debería mostrar:
   - ✅ Estado: **Active**
   - ✅ Checkmark verde junto a "Webhook"
   - ✅ Última verificación exitosa

## 🧪 Test de Verificación

### Test 1: Verificar que el webhook esté activo
```bash
# Reemplaza con tu URL real de Vercel
curl "https://tu-app.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=test123"
```

### Test 2: Enviar mensaje de prueba
1. Envía un mensaje desde el número del proveedor (`+5491135562673`)
2. Deberías ver en los logs de Vercel:
   ```
   📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
   📨 [webhook_xxx] MENSAJES ENCONTRADOS: 1
   ```

## 🔍 Verificar Logs de Vercel

### Opción A: Dashboard de Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Selecciona tu proyecto
3. Ve a la pestaña **Functions**
4. Haz clic en `/api/whatsapp/webhook`
5. Revisa los logs para ver si se están recibiendo requests

### Opción B: CLI de Vercel
```bash
# Instalar Vercel CLI si no lo tienes
npm install -g vercel

# Ver logs en tiempo real
vercel logs --follow
```

## 🚨 Posibles Problemas

### 1. URL Incorrecta
- **Problema**: La URL del webhook en WhatsApp Business Manager no apunta a Vercel
- **Solución**: Actualizar la URL a `https://tu-app.vercel.app/api/whatsapp/webhook`

### 2. Verify Token Incorrecto
- **Problema**: El verify token no coincide
- **Solución**: Verificar que `WHATSAPP_VERIFY_TOKEN` en `.env.local` coincida con el configurado en WhatsApp Business Manager

### 3. Webhook Fields No Suscritos
- **Problema**: Los campos `messages` y `message_deliveries` no están suscritos
- **Solución**: Suscribirse a estos campos en WhatsApp Business Manager

### 4. Permisos de la Aplicación
- **Problema**: La aplicación no tiene permisos suficientes
- **Solución**: Verificar que la aplicación tenga los permisos:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`

## 🎯 Próximos Pasos

1. **Verificar configuración** en WhatsApp Business Manager
2. **Enviar mensaje de prueba** desde el número del proveedor
3. **Revisar logs de Vercel** para confirmar recepción
4. **Verificar que aparezca** en el chat de la aplicación

## 📞 Información de Contacto
- **Número del proveedor**: `+5491135562673`
- **Orden actual**: `ORD-251003-GTT3`
- **Estado esperado**: El proveedor debe enviar una factura para continuar el flujo
