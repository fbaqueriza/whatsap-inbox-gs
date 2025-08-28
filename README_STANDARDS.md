# 📋 ESTÁNDARES DEL PROYECTO GASTRONOMY-SAAS

## 🎯 OBJETIVO

Este documento define los estándares centrales para el manejo de datos en el proyecto, asegurando consistencia, robustez y mantenibilidad en todo el código.

## 📱 ESTÁNDARES DE NÚMEROS DE TELÉFONO

### Formato E.164 para Argentina
- **Formato requerido**: `+54XXXXXXXXXX`
- **Ejemplo**: `+5491140494130`
- **Longitud**: 12-14 caracteres
- **Patrón**: `/^\+54[9]\d{8,9}$/`

### Normalización Automática
El sistema normaliza automáticamente los siguientes formatos:
- `91140494130` → `+5491140494130`
- `1140494130` → `+5491140494130`
- `5491140494130` → `+5491140494130`

### Validación
```typescript
import { VALIDATIONS } from '../lib/standards';

const result = VALIDATIONS.PHONE('91140494130');
// { isValid: true, normalized: '+5491140494130' }
```

## 🆔 ESTÁNDARES DE IDs Y CÓDIGOS

### IDs de Órdenes
- **Formato**: `ORD-YYYY-SSSSSS`
- **Ejemplo**: `ORD-2025-001234`
- **Componentes**:
  - `ORD`: Prefijo fijo
  - `YYYY`: Año (4 dígitos)
  - `SSSSSS`: Secuencial (6 dígitos, padding con ceros)

### Generación
```typescript
import { ORDER_ID_STANDARDS } from '../lib/standards';

const orderId = ORDER_ID_STANDARDS.GENERATE(1234, 2025);
// Resultado: "ORD-2025-001234"
```

### Validación
```typescript
const isValid = ORDER_ID_STANDARDS.VALIDATE('ORD-2025-001234');
// true
```

## 📅 ESTÁNDARES DE FECHAS Y HORAS

### Formato ISO 8601 UTC
- **Formato**: `YYYY-MM-DDTHH:mm:ss.sssZ`
- **Ejemplo**: `2025-08-27T17:52:55.627Z`
- **Zona horaria**: UTC (siempre)

### Formateo
```typescript
import { DATETIME_STANDARDS } from '../lib/standards';

// Para BD (ISO 8601 UTC)
const isoDate = DATETIME_STANDARDS.FORMAT_ISO(new Date());

// Para UI (Argentina)
const displayDate = DATETIME_STANDARDS.FORMAT_DISPLAY(new Date(), true);
// "27 ago 2025, 14:52"
```

## 📊 ESTÁNDARES DE ESTADOS DE ÓRDENES

### Estados Principales
| Estado | Etiqueta | Descripción |
|--------|----------|-------------|
| `pending` | Pendiente | Orden creada, pendiente de envío |
| `sent` | Enviado | Orden enviada al proveedor |
| `confirmed` | Confirmado | Proveedor confirmó recepción |
| `factura_recibida` | Factura Recibida | Factura recibida del proveedor |
| `pagado` | Pagado | Orden pagada |
| `enviado` | Enviado | Productos enviados |
| `delivered` | Entregado | Productos entregados |
| `finalizado` | Finalizado | Orden completada |
| `cancelled` | Cancelado | Orden cancelada |

### Validación y Etiquetas
```typescript
import { ORDER_STATUS_STANDARDS } from '../lib/standards';

const isValid = ORDER_STATUS_STANDARDS.VALIDATE('pending');
const label = ORDER_STATUS_STANDARDS.GET_LABEL('pending');
// "Pendiente"
```

## 🗄️ ESTÁNDARES DE CAMPOS DE BASE DE DATOS

### Convención: snake_case
Todos los campos de base de datos usan `snake_case`:

| Campo Frontend | Campo BD | Descripción |
|----------------|----------|-------------|
| `providerId` | `provider_id` | ID del proveedor |
| `orderNumber` | `order_number` | Número de orden |
| `totalAmount` | `total_amount` | Monto total |
| `createdAt` | `created_at` | Fecha de creación |
| `contactName` | `contact_name` | Nombre de contacto |

### Campos Principales
```typescript
export const DB_FIELD_STANDARDS = {
  ORDER_ID: 'order_id',
  PROVIDER_ID: 'provider_id',
  USER_ID: 'user_id',
  PROVIDER_PHONE: 'provider_phone',
  ORDER_DATA: 'order_data',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at'
};
```

## ✅ VALIDACIONES CENTRALES

### Validación de Teléfonos
```typescript
const phoneValidation = VALIDATIONS.PHONE('91140494130');
if (!phoneValidation.isValid) {
  console.error(phoneValidation.error);
}
```

### Validación de IDs de Orden
```typescript
const orderValidation = VALIDATIONS.ORDER_ID('ORD-2025-001234');
if (!orderValidation.isValid) {
  console.error(orderValidation.error);
}
```

### Validación de Estados
```typescript
const statusValidation = VALIDATIONS.ORDER_STATUS('pending');
if (!statusValidation.isValid) {
  console.error(statusValidation.error);
}
```

### Validación de Fechas
```typescript
const dateValidation = VALIDATIONS.DATETIME('2025-08-27T17:52:55.627Z');
if (!dateValidation.isValid) {
  console.error(dateValidation.error);
}
```

## 🔄 NORMALIZACIÓN DE DATOS

### Para Base de Datos
```typescript
import { NORMALIZATION } from '../lib/standards';

// Normalizar orden para BD
const dbOrder = NORMALIZATION.ORDER_FOR_DB({
  id: '123',
  providerId: '456', // Se convierte a provider_id
  orderNumber: 'ORD-2025-001', // Se convierte a order_number
  // ...
});

// Normalizar proveedor para BD
const dbProvider = NORMALIZATION.PROVIDER_FOR_DB({
  id: '456',
  contactName: 'Juan Pérez', // Se convierte a contact_name
  // ...
});
```

## 🛠️ IMPLEMENTACIÓN EN ENDPOINTS

### Ejemplo de Uso en API
```typescript
import { VALIDATIONS, DATETIME_STANDARDS } from '../../../../lib/standards';

export async function POST(request: NextRequest) {
  try {
    const { providerPhone } = await request.json();
    
    // Validar número de teléfono
    const phoneValidation = VALIDATIONS.PHONE(providerPhone);
    if (!phoneValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: phoneValidation.error,
        timestamp: DATETIME_STANDARDS.FORMAT_ISO(new Date())
      }, { status: 400 });
    }
    
    const normalizedPhone = phoneValidation.normalized;
    // ... resto del código
  } catch (error) {
    // ...
  }
}
```

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Para Nuevos Endpoints
- [ ] Importar estándares desde `../../../../lib/standards`
- [ ] Usar `VALIDATIONS.PHONE()` para números de teléfono
- [ ] Usar `DATETIME_STANDARDS.FORMAT_ISO()` para timestamps
- [ ] Usar `DB_FIELD_STANDARDS` para nombres de campos
- [ ] Validar estados con `ORDER_STATUS_STANDARDS.VALIDATE()`

### Para Nuevos Componentes
- [ ] Usar `DATETIME_STANDARDS.FORMAT_DISPLAY()` para fechas en UI
- [ ] Usar `ORDER_STATUS_STANDARDS.GET_LABEL()` para etiquetas
- [ ] Normalizar datos con `NORMALIZATION` antes de enviar a BD

### Para Base de Datos
- [ ] Usar `snake_case` para todos los campos
- [ ] Usar `provider_id` en lugar de `providerId`
- [ ] Usar `created_at` y `updated_at` para timestamps
- [ ] Usar formato ISO 8601 UTC para fechas

## 🚨 ERRORES COMUNES A EVITAR

### ❌ Incorrecto
```typescript
// Usar camelCase en BD
const order = { providerId: '123', orderNumber: 'ORD-001' };

// No validar números de teléfono
const phone = '91140494130'; // Sin normalizar

// Usar fechas sin formato estándar
const date = new Date().toString();
```

### ✅ Correcto
```typescript
// Usar snake_case en BD
const order = { provider_id: '123', order_number: 'ORD-001' };

// Validar y normalizar números de teléfono
const phoneValidation = VALIDATIONS.PHONE('91140494130');
const phone = phoneValidation.normalized;

// Usar formato ISO 8601 UTC
const date = DATETIME_STANDARDS.FORMAT_ISO(new Date());
```

## 📚 REFERENCIAS

- **E.164**: Formato internacional para números de teléfono
- **ISO 8601**: Estándar internacional para fechas y horas
- **snake_case**: Convención de nomenclatura para BD
- **camelCase**: Convención de nomenclatura para JavaScript/TypeScript

---

**Última actualización**: 27 de agosto de 2025
**Versión**: 1.0.0
