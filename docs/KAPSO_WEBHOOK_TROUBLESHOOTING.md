# 🔧 Solución de Problemas - Webhook de Kapso

## 🚨 **PROBLEMA IDENTIFICADO**

Según los logs, **solo estamos recibiendo estados de mensajes** (`sent`, `delivered`, `read`) pero **NO estamos recibiendo los mensajes reales con contenido**. Esto significa que:

1. ✅ **Kapso está funcionando como proxy de Meta** (correcto)
2. ❌ **Pero no está enviando los mensajes reales al webhook** (problema)

## 🔍 **ANÁLISIS DE LOS LOGS**

### **Lo que SÍ llega:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "value": {
            "statuses": [
              {
                "status": "sent",
                "id": "wamid.xxx"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### **Lo que NO llega:**
```json
{
  "object": "whatsapp_business_account", 
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "type": "document",
                "document": {
                  "filename": "factura.pdf",
                  "url": "https://..."
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## 🛠️ **SOLUCIONES**

### **1. Verificar Configuración en Kapso**

Según la documentación de Kapso, necesitas configurar:

#### **A. Webhook URL**
- URL: `https://tu-dominio.com/api/kapso/supabase-events`
- Método: POST
- Secreto: `2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb`

#### **B. Eventos a Suscribir**
En la configuración de Kapso, asegúrate de que estén habilitados:
- ✅ **Mensajes entrantes** (incoming messages)
- ✅ **Documentos** (documents)
- ✅ **Estados de mensajes** (message statuses)

#### **C. Configuración del Número**
- Verifica que el número esté configurado correctamente
- Asegúrate de que esté en modo "production" (no sandbox)

### **2. Verificar en la Consola de Kapso**

1. **Ve a la configuración de webhooks**
2. **Verifica que esté configurado para recibir:**
   - Mensajes de texto
   - Documentos
   - Imágenes
   - Audio
   - Video

3. **Verifica que el webhook esté activo**
4. **Revisa los logs de webhook en Kapso**

### **3. Probar con Endpoint de Test**

Usa el endpoint de test que creamos:
```
POST /api/kapso/test-document
```

Este simula el envío de un documento para verificar que el procesamiento funciona.

### **4. Verificar Logs Mejorados**

Con el logging mejorado, ahora deberías ver:
- `📨 [requestId] Mensajes recibidos:` - Para ver qué mensajes llegan
- `📊 [requestId] Detalles del mensaje:` - Para ver la estructura completa

## 🔧 **CONFIGURACIÓN CORRECTA**

### **En Kapso Dashboard:**

1. **Webhook Configuration:**
   ```
   URL: https://tu-dominio.com/api/kapso/supabase-events
   Secret: 2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb
   Events: All WhatsApp events
   ```

2. **WhatsApp Configuration:**
   ```
   Number: +5491141780300
   Mode: Production
   Webhook: Enabled
   ```

3. **Message Types:**
   ```
   ✅ Text messages
   ✅ Documents
   ✅ Images
   ✅ Audio
   ✅ Video
   ✅ Status updates
   ```

## 📋 **CHECKLIST DE VERIFICACIÓN**

- [ ] **Webhook configurado** en Kapso con URL correcta
- [ ] **Secreto configurado** correctamente
- [ ] **Eventos habilitados** para mensajes y documentos
- [ ] **Número en modo producción** (no sandbox)
- [ ] **Webhook activo** en Kapso
- [ ] **Probar envío de mensaje** de texto
- [ ] **Probar envío de documento** (PDF)
- [ ] **Revisar logs** para ver si llegan mensajes reales

## 🚨 **SEÑALES DE PROBLEMA**

### **Si solo ves estados:**
```
📊 [requestId] Estado de mensaje: sent para wamid.xxx
```
**→ Problema:** Webhook no configurado para mensajes reales

### **Si ves mensajes reales:**
```
📨 [requestId] Procesando 1 mensajes reales
📨 [requestId] Mensajes recibidos: [{"type": "document", ...}]
```
**→ Correcto:** Webhook funcionando

## 📞 **SIGUIENTE PASO**

1. **Verifica la configuración en Kapso**
2. **Asegúrate de que estén habilitados los eventos de mensajes**
3. **Prueba enviando un mensaje de texto**
4. **Prueba enviando un documento**
5. **Revisa los logs para confirmar que llegan los mensajes reales**

---

*Documentación generada basada en logs de debugging*
*Última actualización: $(date)*
