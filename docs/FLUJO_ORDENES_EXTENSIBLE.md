# 🔧 FLUJO DE ÓRDENES EXTENSIBLE

## 📋 Descripción

El sistema de flujo de órdenes está diseñado para ser **completamente extensible** y permitir modificaciones fáciles sin romper la funcionalidad existente.

## 🚀 Cómo Funciona

### 1. **Configuración Centralizada**
Todo el flujo está definido en `src/lib/orderFlowConfig.ts`:

```typescript
export const ORDER_FLOW_CONFIG = {
  STATES: {
    STANDBY: 'standby',
    ENVIADO: 'enviado', 
    ESPERANDO_FACTURA: 'esperando_factura',
    PENDIENTE_DE_PAGO: 'pendiente_de_pago',
    PAGADO: 'pagado'
  },
  
  TRANSITIONS: {
    // standby → enviado (cualquier mensaje del proveedor)
    [ORDER_STATUS.STANDBY]: {
      next: ORDER_STATUS.ENVIADO,
      trigger: 'provider_response',
      action: 'send_order_details'
    },
    // ... más transiciones
  }
}
```

### 2. **Servicio Extensible**
El `ExtensibleOrderFlowService` usa automáticamente la configuración para:
- ✅ Buscar órdenes por estado
- ✅ Validar transiciones
- ✅ Ejecutar acciones automáticamente
- ✅ Enviar mensajes apropiados

## 🔧 Cómo Modificar el Flujo

### ➕ **Agregar Nuevo Estado**

1. **Agregar estado en la configuración:**
```typescript
// En orderFlowConfig.ts
STATES: {
  STANDBY: 'standby',
  ENVIADO: 'enviado',
  NUEVO_ESTADO: 'nuevo_estado', // ← NUEVO
  ESPERANDO_FACTURA: 'esperando_factura',
  // ...
}
```

2. **Agregar transición:**
```typescript
TRANSITIONS: {
  [ORDER_STATUS.ENVIADO]: {
    next: ORDER_STATUS.NUEVO_ESTADO, // ← NUEVO
    trigger: 'nuevo_evento',
    action: 'nueva_accion'
  }
}
```

3. **Agregar validación:**
```typescript
VALIDATIONS: {
  NUEVO_ESTADO: {
    canTransitionTo: [ORDER_STATUS.ESPERANDO_FACTURA],
    requiredFields: ['order_number']
  }
}
```

4. **Agregar mensaje:**
```typescript
MESSAGES: {
  nueva_accion: (order: any) => {
    return `Mensaje para el nuevo estado: ${order.order_number}`;
  }
}
```

### ➖ **Quitar Estado**

1. **Remover de STATES**
2. **Remover transiciones que lo usen**
3. **Remover validaciones**
4. **Remover mensajes asociados**

### 🔄 **Modificar Transiciones**

1. **Cambiar el estado siguiente:**
```typescript
[ORDER_STATUS.STANDBY]: {
  next: ORDER_STATUS.OTRO_ESTADO, // ← CAMBIAR
  trigger: 'provider_response',
  action: 'send_order_details'
}
```

2. **Cambiar la acción:**
```typescript
[ORDER_STATUS.STANDBY]: {
  next: ORDER_STATUS.ENVIADO,
  trigger: 'provider_response',
  action: 'nueva_accion' // ← CAMBIAR
}
```

### 📱 **Modificar Mensajes**

1. **Editar mensaje existente:**
```typescript
MESSAGES: {
  send_order_details: (order: any, provider: any) => {
    return `NUEVO MENSAJE PERSONALIZADO para ${order.order_number}`;
  }
}
```

2. **Agregar nuevo mensaje:**
```typescript
MESSAGES: {
  nuevo_mensaje: (order: any) => {
    return `Contenido del nuevo mensaje`;
  }
}
```

## 🎯 **Ejemplos de Modificaciones**

### Ejemplo 1: Agregar Estado de "En Proceso"

```typescript
// 1. Agregar estado
STATES: {
  EN_PROCESO: 'en_proceso'
}

// 2. Modificar transición
[ORDER_STATUS.ENVIADO]: {
  next: ORDER_STATUS.EN_PROCESO, // En lugar de ESPERANDO_FACTURA
  trigger: 'provider_confirmation',
  action: 'send_processing_confirmation'
}

// 3. Agregar nueva transición
[ORDER_STATUS.EN_PROCESO]: {
  next: ORDER_STATUS.ESPERANDO_FACTURA,
  trigger: 'processing_complete',
  action: 'send_invoice_request'
}

// 4. Agregar validaciones
VALIDATIONS: {
  EN_PROCESO: {
    canTransitionTo: [ORDER_STATUS.ESPERANDO_FACTURA],
    requiredFields: ['order_number']
  }
}

// 5. Agregar mensaje
MESSAGES: {
  send_processing_confirmation: (order: any) => {
    return `✅ Orden ${order.order_number} en proceso. Le notificaremos cuando esté lista.`;
  }
}
```

### Ejemplo 2: Agregar Estado de "Cancelado"

```typescript
// 1. Agregar estado
STATES: {
  CANCELADO: 'cancelado'
}

// 2. Agregar transiciones desde múltiples estados
[ORDER_STATUS.STANDBY]: {
  next: ORDER_STATUS.CANCELADO,
  trigger: 'order_cancelled',
  action: 'send_cancellation_notice'
}

// 3. Estado final (sin transiciones)
VALIDATIONS: {
  CANCELADO: {
    canTransitionTo: [], // Estado final
    requiredFields: ['order_number', 'cancellation_reason']
  }
}

// 4. Mensaje de cancelación
MESSAGES: {
  send_cancellation_notice: (order: any) => {
    return `❌ Orden ${order.order_number} cancelada. Motivo: ${order.cancellation_reason}`;
  }
}
```

## ✅ **Ventajas del Sistema Extensible**

1. **🔧 Fácil Modificación**: Cambiar el flujo editando solo un archivo
2. **🛡️ Validación Automática**: El sistema valida transiciones automáticamente
3. **📱 Mensajes Automáticos**: Los mensajes se generan automáticamente
4. **🔄 Sin Romper Código**: Las modificaciones no afectan el código existente
5. **📊 Trazabilidad**: Fácil seguimiento de estados y transiciones
6. **🎯 Consistencia**: Todos los cambios siguen el mismo patrón

## 🚀 **Flujo Actual**

```
standby → enviado → esperando_factura → pendiente_de_pago → pagado
   ↓         ↓            ↓                    ↓            ↓
 mensaje   detalles   solicitud_factura   procesar_factura completar
```

## 📝 **Notas Importantes**

- ✅ **Siempre agregar validaciones** para nuevos estados
- ✅ **Mantener consistencia** en nombres de estados
- ✅ **Probar transiciones** después de modificaciones
- ✅ **Actualizar documentación** cuando se modifique el flujo
- ✅ **Usar constantes** en lugar de strings hardcodeados

---

**¡El sistema está diseñado para crecer con tus necesidades sin romper la funcionalidad existente!** 🎉
