# 🌐 Configuración de Ngrok - Webhook Local

**Fecha**: 10 de Octubre 2025
**Status**: ✅ Ngrok Activo

---

## 📍 URLs Actuales

- **Ngrok URL Pública**: `https://1317e12be886.ngrok-free.app`
- **Webhook URL**: `https://1317e12be886.ngrok-free.app/api/whatsapp/webhook`
- **Servidor Local**: `http://localhost:3001`
- **Ngrok Dashboard**: `http://localhost:4040`

---

## 🔧 Pasos para Configurar el Webhook en Meta

### 1. Acceder a Meta Developer Console
1. Ve a: https://developers.facebook.com/
2. Haz login con tu cuenta
3. Selecciona tu app de WhatsApp Business

### 2. Configurar Webhook

#### Opción A: Desde WhatsApp > Configuration
1. En el menú lateral, ve a **WhatsApp** > **Configuration**
2. Busca la sección **Webhook**
3. Haz clic en **Edit** o **Configure**

#### Opción B: Desde Webhooks
1. En el menú lateral, ve a **Webhooks**
2. Selecciona el producto **WhatsApp**

### 3. Ingresar Datos del Webhook

**Callback URL (requerido)**:
```
https://1317e12be886.ngrok-free.app/api/whatsapp/webhook
```

**Verify Token (requerido)**:
- Usa el token que está en tu archivo `.env`
- Variable: `WHATSAPP_VERIFY_TOKEN`
- Si no recuerdas cuál es, corre: `node -e "require('dotenv').config(); console.log(process.env.WHATSAPP_VERIFY_TOKEN);"`

### 4. Verificar y Guardar
1. Haz clic en **Verify and Save** o **Guardar**
2. Meta enviará un request de verificación
3. Si todo está bien, verás ✅ "Verified"

### 5. Suscribirse a Eventos
Asegúrate de que estés suscrito a estos campos:
- ✅ **messages** (obligatorio)
- ✅ **message_template_status_update** (opcional)

---

## 🧪 Prueba Inmediata

Una vez configurado el webhook:

### Test 1: Mensaje de Texto
1. Envía un mensaje de texto desde WhatsApp al número del negocio
2. Observa la terminal local
3. Deberías ver:
   ```
   📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
   📨 [webhook_xxx] Mensaje completo recibido
   ✅ [webhook_xxx] Mensaje guardado
   ```

### Test 2: Documento PDF
1. Envía un PDF desde WhatsApp
2. Observa la terminal local
3. Deberías ver:
   ```
   📥 [webhook_xxx] ===== WEBHOOK RECIBIDO =====
   📎 Usando processWhatsAppDocument para crear mensaje en chat...
   📱 Mensaje de documento guardado en chat con ID: [uuid]
   ✅ Documento procesado y mensaje creado
   ```
4. **SIN refrescar el navegador**, el documento debe aparecer en el chat
5. Debe tener icono 📎 y botón de descarga

---

## 🔍 Monitoreo

### Ver Logs del Webhook
La terminal donde corre `npm run dev` mostrará todos los logs del webhook.

### Dashboard de Ngrok
Ve a: http://localhost:4040
- Verás todas las requests que llegan
- Puedes inspeccionar cada request
- Útil para debugging

### Logs de Vercel (comparación)
Para ver los logs de Vercel:
1. Ve a: https://vercel.com/
2. Selecciona tu proyecto
3. Ve a **Logs** o **Deployments** > [último deploy] > **Logs**

---

## ⚠️ Notas Importantes

### Ngrok Gratis
- La URL cambia cada vez que reinicias ngrok
- Tendrás que actualizar el webhook en Meta cada vez
- Máximo 40 conexiones/minuto (suficiente para pruebas)

### Cuando Funcione
Una vez que confirmes que funciona con ngrok:
1. El código ya está pusheado a GitHub
2. Vercel hará el deploy automáticamente
3. Luego podrás volver a configurar el webhook a la URL de Vercel
4. Y apagar ngrok

### Si Ngrok se Desconecta
Si ngrok se desconecta o cierras la terminal:
1. Reinicia ngrok: `.\ngrok.exe http 3001`
2. Obten la nueva URL
3. Actualiza el webhook en Meta con la nueva URL

---

## 🎯 Próximos Pasos

1. **Actualizar webhook en Meta** con la URL de ngrok
2. **Enviar un PDF de prueba** desde WhatsApp
3. **Verificar que aparece en el chat** en tiempo real
4. **Si funciona**: Confirmar que el código está correcto
5. **Esperar deploy de Vercel**: Luego cambiar webhook a Vercel
6. **Cerrar ngrok**: Ya no será necesario

---

## 📚 Comandos Útiles

### Ver logs del webhook en tiempo real
```bash
# La terminal donde corre npm run dev ya los muestra
```

### Obtener URL actual de ngrok
```powershell
(Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing).Content | ConvertFrom-Json | Select-Object -ExpandProperty tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -ExpandProperty public_url
```

### Ver token de verificación
```bash
node -e "require('dotenv').config(); console.log(process.env.WHATSAPP_VERIFY_TOKEN);"
```

### Reiniciar servidor local
```bash
# Ctrl+C para detener
npm run dev
```

---

**¿Todo listo?** Actualiza el webhook en Meta y luego envía un PDF para probar 🚀

