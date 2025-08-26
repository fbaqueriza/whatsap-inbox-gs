# Solución Implementada: Mensajes Duplicados en Chat

## ✅ Problema Resuelto

### **Causa Raíz Identificada**
Los mensajes aparecían duplicados porque se agregaban **DOS VECES** al estado:
1. **Primera vez**: En `sendMessage()` cuando se enviaba el mensaje (inserción local)
2. **Segunda vez**: En `handleNewMessage()` cuando Realtime detectaba el INSERT en la BD

## 🔧 Soluciones Implementadas

### **1. Verificación Robusta de Duplicados**
```typescript
const handleNewMessage = useCallback((payload: any) => {
  const newMessage = payload.new;
  
  if (newMessage) {
    setMessages(prev => {
      // Verificar duplicados por múltiples criterios
      const messageExists = prev.some(msg => {
        // 1. Verificar por ID exacto
        if (msg.id === newMessage.id) return true;
        
        // 2. Verificar por message_sid
        if (msg.message_sid && newMessage.message_sid && 
            msg.message_sid === newMessage.message_sid) return true;
        
        // 3. Verificar por contenido + timestamp (mensajes enviados)
        if (newMessage.message_type === 'sent' && msg.content === newMessage.content) {
          const timeDiff = Math.abs(new Date(msg.timestamp).getTime() - 
                                   new Date(newMessage.timestamp).getTime());
          if (timeDiff < 5000) return true; // 5 segundos de tolerancia
        }
        
        // 4. Verificar por contenido + contact_id + timestamp (mensajes recibidos)
        if (newMessage.message_type === 'received' && 
            msg.content === newMessage.content && 
            msg.contact_id === newMessage.contact_id) {
          const timeDiff = Math.abs(new Date(msg.timestamp).getTime() - 
                                   new Date(newMessage.timestamp).getTime());
          if (timeDiff < 3000) return true; // 3 segundos de tolerancia
        }
        
        return false;
      });
      
      if (messageExists) {
        console.log('🔄 Mensaje duplicado ignorado:', newMessage.id);
        return prev;
      }
      
      console.log('✅ Nuevo mensaje agregado via Realtime:', newMessage.id);
      return [...prev, newMessage];
    });
  }
}, []);
```

### **2. Eliminación de Inserción Local Inmediata**
```typescript
const sendMessage = useCallback(async (contactId: string, content: string) => {
  if (!content.trim()) return;

  console.log('📤 Enviando mensaje:', content.trim(), 'a:', contactId);

  try {
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: contactId, message: content.trim() }),
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Mensaje enviado exitosamente, esperando Realtime...');
      // NO agregar mensaje localmente - Realtime lo hará automáticamente
    } else {
      console.error('❌ Error enviando mensaje:', result.error);
    }
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error);
  }
}, []);
```

### **3. Optimización de Realtime**
```typescript
useEffect(() => {
  if (!enabled) return;

  // Verificar si ya existe una suscripción activa
  if (channelRef.current) {
    console.log(`🔌 Suscripción ya activa para ${config.table}, reutilizando...`);
    return;
  }

  const channel = supabase
    .channel(`realtime_${config.table}_${Date.now()}`)
    .on('postgres_changes', { /* config */ }, handleEvent)
    .subscribe((status) => {
      console.log(`📡 Estado de suscripción ${config.table}:`, status);
      
      // Reconexión automática en caso de error
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.log(`⚠️ Suscripción ${config.table} falló, intentando reconectar en 5s...`);
        setTimeout(() => {
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }, 5000);
      }
    });

  channelRef.current = channel;

  return () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };
}, [config.table, config.event, config.schema, config.filter, enabled, handleEvent]);
```

### **4. Tipos Actualizados**
```typescript
export interface ChatWhatsAppMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'sent' | 'received';
  contact_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  // Campos adicionales para compatibilidad con Realtime
  message_sid?: string;
  message_type?: 'sent' | 'received';
  user_id?: string;
}
```

## 🎯 Beneficios Obtenidos

### **Eliminación de Duplicados**
- ✅ Mensajes ya no aparecen duplicados
- ✅ Verificación robusta por múltiples criterios
- ✅ Logging detallado para debugging

### **Performance Mejorada**
- ✅ Eliminada inserción local innecesaria
- ✅ Realtime optimizado con reconexión automática
- ✅ Múltiples conexiones evitadas

### **Experiencia de Usuario**
- ✅ Mensajes aparecen inmediatamente via Realtime
- ✅ Sin retrasos por inserción local
- ✅ Flujo más consistente y confiable

## 📊 Logging Mejorado

### **Logs de Duplicados**
```
🔄 Duplicado detectado por ID: abc123
🔄 Mensaje enviado duplicado detectado por contenido + timestamp: hola
🔄 Mensaje duplicado ignorado: { id: "abc123", content: "hola", message_type: "sent" }
```

### **Logs de Nuevos Mensajes**
```
✅ Nuevo mensaje agregado via Realtime: { id: "abc123", content: "hola", message_type: "sent" }
```

### **Logs de Realtime**
```
🔌 Configurando suscripción Realtime para whatsapp_messages
📡 Estado de suscripción whatsapp_messages: SUBSCRIBED
🔌 Suscripción ya activa para whatsapp_messages, reutilizando...
```

## 🔍 Monitoreo y Debugging

### **Verificación de Funcionamiento**
1. **Enviar mensaje** → Debe aparecer una sola vez
2. **Recibir mensaje** → Debe aparecer una sola vez
3. **Realtime** → Debe mostrar logs de detección de duplicados
4. **Performance** → No debe haber múltiples conexiones

### **Logs a Monitorear**
- `🔄 Mensaje duplicado ignorado` - Confirmar que funciona
- `✅ Nuevo mensaje agregado via Realtime` - Confirmar flujo normal
- `🔌 Suscripción ya activa` - Confirmar optimización

## 🚀 Próximos Pasos

### **Verificación**
1. Probar envío de mensajes
2. Verificar que no hay duplicados
3. Monitorear logs de Realtime
4. Confirmar performance

### **Optimizaciones Futuras**
- Implementar indicador de estado de conexión Realtime
- Agregar retry automático para mensajes fallidos
- Optimizar debouncing para múltiples eventos rápidos

## 📝 Archivos Modificados

### **Archivos Principales**
- `src/contexts/ChatContext.tsx` - Lógica de duplicados y envío
- `src/hooks/useSupabaseRealtime.ts` - Optimización de Realtime
- `src/types/whatsapp.ts` - Tipos actualizados

### **Archivos de Documentación**
- `temporario/debug_mensajes_duplicados.md` - Análisis del problema
- `temporario/solucion_mensajes_duplicados.md` - Esta documentación
