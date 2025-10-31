# 📡 ACTUALIZACIÓN PLATFORM API KAPSO

**Fecha:** 2025-01-24  
**Referencia:** [Platform API Documentation](https://docs.kapso.ai/api-reference/platform-introduction)  
**Estado:** ✅ Actualizado según documentación oficial

## 🎯 CAMBIOS IMPLEMENTADOS

### **1. Estructura de Requests Corregida**

#### **Create Customer**
```typescript
// ❌ ANTES (incorrecto)
await fetch('/customers', {
  body: JSON.stringify({ name: 'Acme', external_customer_id: '123' })
});

// ✅ AHORA (correcto según docs)
await fetch('/customers', {
  body: JSON.stringify({
    customer: {
      name: 'Acme',
      external_customer_id: '123',
      metadata: {}
    }
  })
});
```

#### **Create Setup Link**
```typescript
// ❌ ANTES (endpoint incorrecto)
await fetch('/setup_links', { ... });

// ✅ AHORA (endpoint correcto)
await fetch('/customers/{customer_id}/setup_links', {
  body: JSON.stringify({
    expires_in: 86400,  // 24 horas
    metadata: {}
  })
});
```

#### **Send Message**
```typescript
// ✅ Estructura correcta según documentación
await fetch('/whatsapp_messages', {
  body: JSON.stringify({
    customer_id: 'customer_id',  // o whatsapp_config_id
    message: {
      phone_number: '+1234567890',
      content: 'Your message',
      message_type: 'text'
    }
  })
});
```

### **2. Métodos Actualizados**

#### **✅ createCustomer**
- Estructura correcta: `{ customer: { ... } }`
- Campos soportados: `name`, `external_customer_id`, `metadata`

#### **✅ createSetupLink**
- Endpoint correcto: `/customers/{customer_id}/setup_links`
- Campos: `expires_in` (segundos), `metadata`

#### **✅ sendMessageOnBehalf**
- Estructura correcta: `{ customer_id, message: { ... } }`
- Soporta: `phone_number`, `content`, `message_type`, `template`

### **3. Logging Mejorado**

```typescript
console.log(`📤 [KapsoPlatform] ${method} ${url}`);
console.error(`❌ [KapsoPlatform] Error ${status}: ${errorText}`);
console.log(`✅ [KapsoPlatform] Response received`);
```

## 🔧 IMPLEMENTACIÓN ACTUAL

### **Métodos Corregidos**
- ✅ `createCustomer()` - Estructura correcta
- ✅ `createSetupLink()` - Endpoint correcto
- ✅ `sendMessageOnBehalf()` - Estructura correcta
- ✅ `makeRequest()` - Logging mejorado

### **Tipos de Error Corregidos**
```typescript
catch (error: any) {  // ✅ Tipado correcto
  return { success: false, error: error.message };
}
```

## 📊 REFERENCIA DE DOCUMENTACIÓN

### **Endpoints Principales**

1. **POST /customers**
   - Crear un nuevo cliente
   - Body: `{ customer: { name, external_customer_id, metadata } }`

2. **POST /customers/{customer_id}/setup_links**
   - Crear link de configuración
   - Body: `{ expires_in, metadata }`

3. **POST /whatsapp_messages**
   - Enviar mensaje en nombre del cliente
   - Body: `{ customer_id, message: { phone_number, content, ... } }`

### **Autenticación**
```bash
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

### **Rate Limits**
- 1000 requests por minuto por API key
- 10 setup links por cliente por hora

## 🚀 PRÓXIMOS PASOS

1. **Testing**: Probar los métodos actualizados con la API real
2. **Componentes**: Reactivar componentes de UI para Platform API
3. **Validación**: Validar respuestas de la API
4. **Errores**: Manejar casos de error específicos de la API

## ✅ ESTADO

- **Documentación**: Implementada según docs oficiales
- **Tipos**: Corregidos y sin errores de linting
- **Logging**: Mejorado para debugging
- **Endpoints**: Estructura correcta según API

---

**Referencia completa:** https://docs.kapso.ai/api-reference/platform-introduction
