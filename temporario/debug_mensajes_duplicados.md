# Debug: Mensajes Duplicados en Chat

## Problema Reportado
- Los mensajes se envían correctamente pero aparecen duplicados en el chat
- Aparecen como "enviado" y como "recibido"
- Se observa en los logs que el Realtime está funcionando correctamente

## Análisis del Flujo de Mensajes

### 1. **Flujo de Envío de Mensaje**
```
1. Usuario escribe mensaje → IntegratedChatPanel
2. Se llama sendMessage() en ChatContext
3. Se agrega mensaje localmente con ID temporal
4. Se envía a /api/whatsapp/send
5. metaWhatsAppService.sendMessage() guarda en BD
6. Se actualiza mensaje local con ID real
```

### 2. **Flujo de Realtime**
```
1. Mensaje guardado en BD → Trigger Realtime INSERT
2. useWhatsAppMessagesRealtime recibe evento
3. handleNewMessage() se ejecuta
4. Se agrega mensaje nuevamente al estado
```

## Causa Raíz Identificada

### **Problema Principal: Doble Inserción**
El mensaje se está agregando **DOS VECES** al estado:

1. **Primera vez**: En `sendMessage()` cuando se envía el mensaje
2. **Segunda vez**: En `handleNewMessage()` cuando Realtime detecta el INSERT

### **Código Problemático**

#### **En ChatContext.tsx - sendMessage():**
```typescript
// Agregar mensaje localmente inmediatamente
setMessages(prev => {
  const updatedMessages = [...prev, newMessage];
  return updatedMessages;
});

// Después de enviar exitosamente, se actualiza con ID real
setMessages(prev => {
  const updatedMessages = prev.map(msg => 
    msg.id === tempId 
      ? { ...msg, id: realMessageId, status: 'delivered' }
      : msg
  );
  return updatedMessages;
});
```

#### **En ChatContext.tsx - handleNewMessage():**
```typescript
const handleNewMessage = useCallback((payload: any) => {
  const newMessage = payload.new;
  
  if (newMessage) {
    setMessages(prev => {
      // Verificar si el mensaje ya existe
      const messageExists = prev.some(msg => msg.id === newMessage.id);
      if (messageExists) {
        return prev; // ← ESTO NO FUNCIONA CORRECTAMENTE
      }
      
      // Agregar el nuevo mensaje ← ESTO SE EJECUTA
      const updatedMessages = [...prev, newMessage];
      return updatedMessages;
    });
  }
}, []);
```

## Problemas Específicos

### **1. Verificación de Duplicados Inefectiva**
- La verificación `msg.id === newMessage.id` falla porque:
  - El mensaje local tiene ID temporal (`temp_${Date.now()}`)
  - El mensaje de Realtime tiene ID real de la BD
  - Nunca coinciden, por lo que siempre se agrega

### **2. Doble Inserción en Base de Datos**
- El mensaje se guarda en `metaWhatsAppService.sendMessage()`
- También se puede guardar en el webhook si hay respuesta de WhatsApp

### **3. Múltiples Instancias de Realtime**
- Los logs muestran múltiples conexiones/desconexiones
- Puede haber múltiples suscripciones activas

## Solución Propuesta

### **Solución 1: Mejorar Verificación de Duplicados**
```typescript
const handleNewMessage = useCallback((payload: any) => {
  const newMessage = payload.new;
  
  if (newMessage) {
    setMessages(prev => {
      // Verificar duplicados por múltiples criterios
      const messageExists = prev.some(msg => 
        msg.id === newMessage.id || // ID exacto
        msg.message_sid === newMessage.message_sid || // Message SID
        (msg.content === newMessage.content && 
         Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 5000) // Contenido + timestamp cercano
      );
      
      if (messageExists) {
        console.log('🔄 Mensaje duplicado detectado, ignorando:', newMessage.id);
        return prev;
      }
      
      console.log('✅ Nuevo mensaje agregado via Realtime:', newMessage.id);
      return [...prev, newMessage];
    });
  }
}, []);
```

### **Solución 2: Evitar Inserción Local para Mensajes Enviados**
```typescript
const sendMessage = useCallback(async (contactId: string, content: string) => {
  if (!content.trim()) return;

  // NO agregar mensaje localmente inmediatamente
  // Esperar a que Realtime lo agregue

  try {
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: contactId, message: content.trim() }),
    });

    const result = await response.json();
    
    if (!result.success) {
      console.error('❌ Error enviando mensaje:', result.error);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}, []);
```

### **Solución 3: Usar Flag para Mensajes Enviados**
```typescript
const handleNewMessage = useCallback((payload: any) => {
  const newMessage = payload.new;
  
  if (newMessage) {
    setMessages(prev => {
      // Si es un mensaje enviado por el usuario actual, verificar si ya existe
      if (newMessage.message_type === 'sent') {
        const messageExists = prev.some(msg => 
          msg.content === newMessage.content &&
          Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 3000
        );
        
        if (messageExists) {
          console.log('🔄 Mensaje enviado duplicado, ignorando');
          return prev;
        }
      }
      
      return [...prev, newMessage];
    });
  }
}, []);
```

## Problemas Relacionados Identificados

### **1. Múltiples Instancias de Realtime**
- Los logs muestran múltiples conexiones/desconexiones
- Posible problema de cleanup en useEffect

### **2. Verificación de Duplicados en Base de Datos**
- `metaWhatsAppService.saveMessage()` ya tiene verificación por `message_sid`
- Pero puede fallar si el `message_sid` no es consistente

### **3. IDs Inconsistentes**
- Mensajes locales usan `temp_${Date.now()}`
- Mensajes de BD usan UUID generado
- Mensajes de Meta usan su propio ID

## Recomendación de Implementación

### **Paso 1: Implementar Solución 3 (Flag para Mensajes Enviados)**
- Es la más robusta y maneja el caso específico
- No rompe funcionalidad existente

### **Paso 2: Mejorar Logging**
- Agregar logs específicos para duplicados
- Monitorear flujo de mensajes

### **Paso 3: Optimizar Realtime**
- Revisar múltiples conexiones
- Mejorar cleanup de suscripciones

### **Paso 4: Estandarizar IDs**
- Usar consistentemente `message_sid` de Meta
- Generar UUIDs consistentes
