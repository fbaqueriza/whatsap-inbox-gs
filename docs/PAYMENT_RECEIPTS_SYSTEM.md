# Sistema de Comprobantes de Pago

## 📋 Descripción General

El sistema de comprobantes de pago permite a los usuarios subir comprobantes de pago y enviarlos automáticamente a los proveedores correspondientes via WhatsApp. El sistema incluye:

- **Subida de comprobantes** con drag & drop
- **Asignación automática** a proveedores por CUIT, monto o datos del comprobante
- **Asignación automática** a órdenes pendientes de pago
- **Envío automático** a proveedores via WhatsApp
- **Seguimiento** del estado de envío

## 🏗️ Arquitectura

### Base de Datos

#### Tabla `payment_receipts`
```sql
- id: UUID (PK)
- user_id: UUID (FK a auth.users)
- provider_id: UUID (FK a providers) - Asignación manual
- order_id: UUID (FK a orders) - Asignación manual
- filename: TEXT - Nombre del archivo
- file_url: TEXT - URL del archivo en storage
- file_size: INTEGER - Tamaño en bytes
- file_type: ENUM - transferencia, cheque, efectivo, tarjeta, other
- mime_type: TEXT - Tipo MIME del archivo
- receipt_number: TEXT - Número del comprobante
- payment_amount: DECIMAL - Monto del pago
- payment_currency: TEXT - Moneda (default: ARS)
- payment_date: DATE - Fecha del pago
- payment_method: ENUM - Método de pago
- auto_assigned_provider_id: UUID - Proveedor asignado automáticamente
- auto_assigned_order_id: UUID - Orden asignada automáticamente
- assignment_confidence: FLOAT - Confianza en la asignación (0-1)
- assignment_method: ENUM - Método de asignación
- sent_to_provider: BOOLEAN - Si fue enviado al proveedor
- sent_at: TIMESTAMP - Fecha de envío
- whatsapp_message_id: TEXT - ID del mensaje de WhatsApp
- status: ENUM - pending, processed, assigned, sent, error
- processing_error: TEXT - Error en el procesamiento
- created_at, updated_at, processed_at: TIMESTAMP
```

#### Tabla `payment_receipt_assignment_attempts`
Registra los intentos de asignación automática para auditoría.

#### Tabla `payment_receipt_notifications`
Notificaciones relacionadas con el procesamiento de comprobantes.

### Servicios

#### `PaymentReceiptService`
- `uploadPaymentReceipt()` - Sube y procesa comprobante
- `processPaymentReceipt()` - Procesa comprobante (OCR + asignación)
- `findMatchingProviders()` - Busca proveedores coincidentes
- `findMatchingOrders()` - Busca órdenes coincidentes
- `sendReceiptToProvider()` - Envía comprobante via WhatsApp
- `getUserPaymentReceipts()` - Obtiene comprobantes del usuario

### Componentes Frontend

#### `PaymentReceiptUploadModal`
Modal para subir comprobantes con:
- Drag & drop de archivos
- Formulario de datos de pago
- Progreso de subida
- Validación de archivos

#### `PaymentReceiptsList`
Lista de comprobantes con:
- Estado de procesamiento
- Información de asignación
- Botones de acción (ver, descargar, enviar)
- Filtros y búsqueda

### API Endpoints

#### `POST /api/payment-receipts/upload`
Sube un comprobante de pago.

**Body (FormData):**
- `file`: Archivo del comprobante
- `userId`: ID del usuario
- `payment_amount`: Monto del pago
- `payment_date`: Fecha del pago
- `payment_method`: Método de pago
- `receipt_number`: Número del comprobante

#### `GET /api/payment-receipts/list?userId={userId}`
Obtiene los comprobantes de pago del usuario.

#### `POST /api/payment-receipts/send`
Envía un comprobante a un proveedor via WhatsApp.

**Body:**
```json
{
  "receiptId": "uuid",
  "providerId": "uuid"
}
```

## 🔄 Flujo de Trabajo

### 1. Subida de Comprobante
1. Usuario selecciona archivo(s) en el modal
2. Completa datos del pago (monto, fecha, método)
3. Sistema valida archivo y datos
4. Archivo se sube a Supabase Storage
5. Se crea registro en `payment_receipts` con estado `pending`

### 2. Procesamiento Automático
1. Sistema procesa comprobante en background
2. Busca proveedores coincidentes por:
   - CUIT en número de comprobante
   - Monto coincidente con órdenes pendientes
3. Busca órdenes coincidentes por:
   - Proveedor asignado
   - Monto exacto
4. Actualiza estado a `assigned` si encuentra coincidencias

### 3. Envío a Proveedor
1. Usuario hace clic en "Enviar" en la lista
2. Sistema genera mensaje personalizado
3. Envía comprobante via WhatsApp API
4. Actualiza estado a `sent` y registra fecha de envío

## 🎯 Asignación Automática

### Criterios de Asignación a Proveedores

1. **CUIT Match (Confianza: 0.9)**
   - Busca CUIT del proveedor en el número de comprobante
   - Coincidencia exacta de CUIT

2. **Amount Match (Confianza: 0.8)**
   - Busca órdenes pendientes de pago con monto exacto
   - Asigna al proveedor de la orden

### Criterios de Asignación a Órdenes

1. **Amount Match (Confianza: 0.9)**
   - Monto exacto entre comprobante y orden
   - Orden debe estar en estado `pendiente_de_pago` o `factura_recibida`

## 📱 Integración WhatsApp

### Mensaje de Envío
```
¡Hola {provider_name}! 👋

Te confirmo que hemos realizado el pago correspondiente. 
Adjunto encontrarás el comprobante de pago.

📄 Comprobante: {receipt_number}
💰 Monto: ${payment_amount}
📅 Fecha: {payment_date}

¡Gracias por tu confianza! 🙏
```

### Archivo Adjunto
- Se envía como documento
- Formato original preservado
- Tamaño máximo: 10MB

## 🔧 Configuración

### Variables de Entorno Requeridas
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Configuración de Storage
- Bucket: `documents`
- Ruta: `payment-receipts/{userId}/{filename}`
- Tipos permitidos: PDF, JPG, PNG
- Tamaño máximo: 10MB

## 🚀 Instalación

### 1. Ejecutar Esquema de Base de Datos
```bash
node scripts/setup-payment-receipts-db.js
```

### 2. Verificar Configuración
- Variables de entorno configuradas
- Storage bucket `documents` creado
- Políticas RLS activas

## 📊 Monitoreo

### Logs Importantes
- `[PaymentReceiptService]` - Operaciones del servicio
- `[API]` - Endpoints de la API
- Errores de asignación automática
- Errores de envío WhatsApp

### Métricas a Monitorear
- Tasa de asignación automática exitosa
- Tiempo de procesamiento
- Errores de envío
- Tamaño de archivos subidos

## 🔒 Seguridad

### Row Level Security (RLS)
- Usuarios solo pueden ver sus propios comprobantes
- Políticas aplicadas a todas las tablas
- Validación de permisos en API endpoints

### Validación de Archivos
- Tipos MIME permitidos
- Tamaño máximo de 10MB
- Sanitización de nombres de archivo

## 🐛 Troubleshooting

### Problemas Comunes

1. **Error de subida de archivo**
   - Verificar tamaño (máx 10MB)
   - Verificar tipo de archivo
   - Verificar permisos de storage

2. **Asignación automática fallida**
   - Verificar datos del proveedor (CUIT)
   - Verificar órdenes pendientes
   - Revisar logs de asignación

3. **Error de envío WhatsApp**
   - Verificar configuración de WhatsApp API
   - Verificar número de teléfono del proveedor
   - Revisar logs de envío

### Logs de Debug
```javascript
// Habilitar logs detallados
console.log('🔍 [PaymentReceiptService] Debug mode enabled');
```

## 📈 Mejoras Futuras

1. **OCR Avanzado**
   - Extracción de datos de comprobantes
   - Validación automática de montos
   - Detección de proveedores por texto

2. **Notificaciones Push**
   - Notificaciones en tiempo real
   - Alertas de errores
   - Confirmaciones de envío

3. **Analytics**
   - Dashboard de comprobantes
   - Métricas de envío
   - Reportes de pagos

4. **Integración Bancaria**
   - Conexión con APIs bancarias
   - Verificación automática de transferencias
   - Conciliación bancaria
