# 📄 Configuración de Documentos en Kapso

## 🚨 **PROBLEMA IDENTIFICADO**

Los mensajes de texto y audios **SÍ llegan al webhook**, pero los **documentos NO llegan**. Esto significa que:

1. ✅ **Webhook funcionando** - Mensajes de texto y audios llegan correctamente
2. ✅ **Procesamiento funcionando** - El endpoint de test confirma que el procesamiento funciona
3. ❌ **Configuración de documentos** - Kapso no está enviando documentos al webhook

## 🔍 **DIAGNÓSTICO**

### **Lo que SÍ funciona:**
- ✅ Mensajes de texto llegan al webhook
- ✅ Audios llegan al webhook
- ✅ Estados de mensajes llegan al webhook
- ✅ Procesamiento de documentos funciona (confirmado con test)

### **Lo que NO funciona:**
- ❌ Documentos no llegan al webhook
- ❌ Solo llegan los links a Kapso, no el documento en sí

## 🛠️ **SOLUCIONES**

### **1. Verificar Configuración en Kapso Dashboard**

#### **A. Webhook Configuration**
Ve a la configuración de webhooks en Kapso y verifica:

```
URL: https://tu-dominio.com/api/kapso/supabase-events
Secret: 2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb
```

#### **B. Eventos Habilitados**
Asegúrate de que estén habilitados **TODOS** estos eventos:
- ✅ **Text messages** (funcionando)
- ✅ **Audio messages** (funcionando)
- ❌ **Document messages** (NO funcionando)
- ✅ **Image messages**
- ✅ **Video messages**
- ✅ **Message statuses**

#### **C. Document Types**
Verifica que estén habilitados estos tipos de documentos:
- ✅ **PDF files**
- ✅ **Word documents**
- ✅ **Excel files**
- ✅ **Images (PNG, JPG)**
- ✅ **Other file types**

### **2. Configuración Específica para Documentos**

#### **A. File Size Limits**
Verifica que no haya límites de tamaño que bloqueen los documentos:
- Límite mínimo: 1MB
- Límite máximo: 100MB (recomendado)

#### **B. MIME Types**
Asegúrate de que estén permitidos estos MIME types:
```
application/pdf
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
image/jpeg
image/png
image/gif
```

#### **C. Webhook Events**
En la configuración de webhooks, asegúrate de que esté habilitado:
- **"Send document events to webhook"**
- **"Include document metadata"**
- **"Include document URLs"**

### **3. Verificar en la Consola de Kapso**

#### **A. Logs de Webhook**
1. Ve a la sección de webhooks en Kapso
2. Revisa los logs de webhook
3. Busca eventos de documentos
4. Verifica si hay errores

#### **B. Test de Documento**
1. Usa la función de test de webhook en Kapso
2. Envía un evento de documento simulado
3. Verifica que llegue al webhook

### **4. Configuración del Número de WhatsApp**

#### **A. Permisos del Número**
Verifica que el número tenga permisos para:
- ✅ Enviar mensajes
- ✅ Recibir mensajes
- ❌ **Recibir documentos** (verificar)

#### **B. Configuración de Media**
Asegúrate de que esté habilitado:
- **"Allow media uploads"**
- **"Allow document uploads"**
- **"Process documents automatically"**

## 🧪 **PRUEBAS**

### **1. Test Endpoint**
Usa el endpoint de test que creamos:
```
POST /api/kapso/test-document
```

### **2. Test Manual**
1. Envía un documento desde el proveedor
2. Revisa los logs del webhook
3. Verifica si aparece el evento de documento

### **3. Logs a Buscar**
Cuando funcione correctamente, deberías ver:
```
📨 [requestId] Procesando 1 mensajes reales
📨 [requestId] Mensajes recibidos: [{"type": "document", "document": {...}}]
🔍 [requestId] Mensaje tipo: document, tiene documento: true
📎 [requestId] ✅ DOCUMENTO DETECTADO - Procesando documento recibido
```

## 📋 **CHECKLIST DE VERIFICACIÓN**

- [ ] **Webhook configurado** con URL correcta
- [ ] **Secreto configurado** correctamente
- [ ] **Eventos de documentos habilitados** en Kapso
- [ ] **Tipos de archivo permitidos** (PDF, DOC, etc.)
- [ ] **Límites de tamaño** configurados correctamente
- [ ] **MIME types** permitidos
- [ ] **Permisos del número** para documentos
- [ ] **Test de webhook** funcionando
- [ ] **Logs de Kapso** sin errores

## 🚨 **SEÑALES DE PROBLEMA**

### **Si no llegan documentos:**
```
📊 [requestId] Estado de mensaje: sent para wamid.xxx
```
**→ Problema:** Solo llegan estados, no mensajes reales

### **Si llegan documentos:**
```
📨 [requestId] Procesando 1 mensajes reales
📨 [requestId] Mensajes recibidos: [{"type": "document", ...}]
```
**→ Correcto:** Documentos llegando al webhook

## 📞 **SIGUIENTE PASO**

1. **Ve al dashboard de Kapso**
2. **Verifica la configuración de webhooks**
3. **Asegúrate de que estén habilitados los eventos de documentos**
4. **Prueba enviando un documento desde el proveedor**
5. **Revisa los logs para confirmar que llega el documento**

---

*Documentación generada basada en análisis de logs*
*Última actualización: $(date)*
