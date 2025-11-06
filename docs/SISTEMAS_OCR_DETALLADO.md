# 📄 Documentación Detallada de Sistemas OCR

## 🎯 Resumen Ejecutivo

El proyecto implementa **múltiples sistemas OCR** para extraer texto y datos estructurados de documentos (principalmente facturas) recibidos por WhatsApp. El sistema utiliza una arquitectura en capas con diferentes servicios especializados.

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    ENTRADA DE DOCUMENTOS                     │
│  (WhatsApp Webhook / Upload Manual / Kapso Events)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA 1: EXTRACCIÓN DE TEXTO (OCR)              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  ocrService.js   │  │  Tesseract.js     │               │
│  │  (Servidor)      │  │  (Cliente)        │               │
│  └──────────────────┘  └──────────────────┘               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         CAPA 2: EXTRACCIÓN DE DATOS ESTRUCTURADOS           │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ invoiceExtraction    │  │ simpleInvoiceExtract │        │
│  │ Service.js           │  │ ion.js               │        │
│  └──────────────────────┘  └──────────────────────┘        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA 3: PROCESAMIENTO Y ALMACENAMIENTO          │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ documentService  │  │ invoiceProcessing│               │
│  │ .ts              │  │ Service.ts       │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Componentes del Sistema OCR

### 1. **OCRService** (`src/lib/ocrService.js`)
**Propósito:** Servicio principal de extracción de texto desde PDFs e imágenes.

**Características:**
- ✅ **Estrategia dual:** Usa dos métodos en cascada
  - **Primario:** `pdf-parse` para PDFs con texto nativo (rápido, 85% confianza)
  - **Fallback:** `Tesseract.js` con preprocessing para PDFs escaneados/imágenes
- ✅ **Preprocessing con Sharp:**
  - Conversión a escala de grises
  - Normalización de contraste
  - Mejora de nitidez (sharpen)
  - Binarización (threshold) para mejor OCR
- ✅ **Configuración optimizada para facturas:**
  - Idiomas: Español + Inglés (`spa+eng`)
  - Whitelist de caracteres: números, letras, símbolos comunes de facturas
  - Modo de segmentación: columna única (`tessedit_pageseg_mode: '4'`)

**Métodos principales:**
```javascript
extractTextFromPDF(pdfBuffer, fileName)
  → Intenta pdf-parse primero, luego Tesseract si falla

extractTextFromImage(imageBuffer, fileName)
  → Procesa imagen con Tesseract + preprocessing Sharp

processPDFFromPath(filePath)
  → Procesa PDF desde ruta del sistema de archivos

cleanText(text)
  → Limpia y normaliza texto extraído
```

**Retorna:**
```javascript
{
  success: boolean,
  text: string,
  confidence: number (0-100),
  processingTime: number (ms),
  pageCount: number,
  method: 'pdf-parse' | 'tesseract' | 'real-text'
}
```

---

### 2. **InvoiceExtractionService** (`src/lib/invoiceExtractionService.js`)
**Propósito:** Extracción avanzada de datos estructurados de facturas usando patrones regex.

**Características:**
- ✅ **Extracción de múltiples campos:**
  - Número de factura
  - Monto total
  - Subtotal
  - Impuestos (IVA)
  - Moneda
  - Fechas (emisión y vencimiento)
  - Nombre del proveedor
  - CUIT/CUIL
  - Items/productos
- ✅ **Patrones regex optimizados para facturas argentinas:**
  - Formatos de montos: `$1.234,56` o `$1234.56`
  - Formatos de fechas: `DD/MM/YYYY` o `YYYY-MM-DD`
  - Formatos de CUIT: `XX-XXXXXXXX-X` o `XXXXXXXXXXX`
- ✅ **Cálculo de confianza:**
  - Sistema de pesos por campo
  - Confianza total basada en campos extraídos

**Métodos principales:**
```javascript
extractFromText(text, fileName)
  → Extrae todos los datos de la factura

extractInvoiceNumber(text)
  → Busca número de factura con múltiples patrones

extractTotalAmount(text)
  → Extrae monto total con validación de rango

extractItems(text)
  → Extrae items/productos de la factura

calculateConfidence(data)
  → Calcula confianza de la extracción (0-1)
```

**Retorna:**
```javascript
{
  success: boolean,
  data: {
    invoiceNumber: string,
    totalAmount: number,
    subtotal: number,
    tax: number,
    currency: string,
    issueDate: string,
    dueDate: string,
    providerName: string,
    providerTaxId: string,
    items: Array<{description, quantity, unitPrice, total}>,
    extractedText: string
  },
  confidence: number (0-1)
}
```

---

### 3. **SimpleInvoiceExtraction** (`src/lib/simpleInvoiceExtraction.js`)
**Propósito:** Versión simplificada y más robusta para extracción básica de facturas.

**Características:**
- ✅ **Enfoque simplificado:** Menos campos pero más confiable
- ✅ **Patrones mejorados para montos:**
  - Prioridad alta a patrones específicos: `Monto: $12345`
  - Manejo robusto de formatos argentinos: `56.383,10`
- ✅ **Extracción de items mejorada:**
  - Múltiples patrones para diferentes formatos de tabla
  - Validación de items para evitar falsos positivos
  - Soporte para 2, 3 y 4 campos por item

**Diferencias con InvoiceExtractionService:**
- Menos campos extraídos (solo los esenciales)
- Patrones más específicos y menos propensos a errores
- Mejor manejo de formatos argentinos
- Cálculo de confianza más simple

**Métodos principales:**
```javascript
extractFromText(text, fileName)
  → Extrae datos básicos de factura

extractTotalAmount(text)
  → Extrae monto con patrones prioritarios

extractItems(text)
  → Extrae items con múltiples estrategias
```

---

### 4. **DocumentService** (`src/lib/documentService.ts`)
**Propósito:** Servicio de alto nivel que orquesta OCR y extracción de datos.

**Características:**
- ✅ **Integración completa:**
  - Llama a `ocrService` para extraer texto
  - Llama a `simpleInvoiceExtraction` para datos estructurados
  - Almacena resultados en Supabase
- ✅ **Gestión de estados:**
  - `pending` → `processing` → `completed` / `failed`
- ✅ **Almacenamiento estructurado:**
  - Guarda `ocr_data` (datos estructurados)
  - Guarda `extracted_text` (texto crudo)
  - Guarda `confidence_score` (0-1)

**Métodos principales:**
```typescript
processDocumentWithOCR(documentId: string)
  → Procesa documento completo: OCR + Extracción + Almacenamiento

extractOCRData(fileUrl: string, fileType: DocumentType)
  → Extrae texto y datos estructurados

processExtractedText(text: string, fileType: DocumentType)
  → Procesa texto para crear datos estructurados
```

**Flujo completo:**
1. Descarga archivo desde URL
2. Llama a `ocrService.extractTextFromPDF()`
3. Llama a `simpleInvoiceExtraction.extractFromText()`
4. Crea estructura `OCRData` con todos los datos
5. Actualiza documento en Supabase con resultados

---

### 5. **InvoiceProcessingService** (`src/lib/invoiceProcessingService.ts`)
**Propósito:** Procesamiento de facturas desde WhatsApp con integración de órdenes.

**Características:**
- ✅ **Flujo completo de factura:**
  - Descarga archivo desde WhatsApp
  - Procesa con OCR
  - Extrae datos
  - Actualiza orden asociada
- ✅ **Integración con órdenes:**
  - Busca orden pendiente del proveedor
  - Actualiza orden con datos de factura
  - Sube archivo a Supabase Storage

**Métodos principales:**
```typescript
processWhatsAppInvoice(mediaUrl, providerPhone, requestId)
  → Procesa factura recibida por WhatsApp

processInvoiceFromUrl(fileUrl, orderId, providerId)
  → Procesa factura desde URL

performOCR(fileBuffer)
  → Wrapper para ocrService

extractInvoiceData(text)
  → Wrapper para invoiceExtractionService
```

---

### 6. **Componentes de Cliente (Frontend)**

#### **InvoiceOCRProcessor** (`src/components/InvoiceOCRProcessor.tsx`)
**Propósito:** Componente React para procesamiento OCR en el cliente.

**Características:**
- ✅ **OCR en el navegador:** Usa Tesseract.js directamente
- ✅ **UI con progreso:** Muestra estado y progreso del OCR
- ✅ **Parsing de facturas:** Extrae datos específicos del texto

**Uso:**
```tsx
<InvoiceOCRProcessor
  fileUrl={fileUrl}
  onOCRComplete={(result) => {...}}
  onError={(error) => {...}}
/>
```

#### **useAutoOCR** (`src/hooks/useAutoOCR.ts`)
**Propósito:** Hook React para OCR automático.

**Características:**
- ✅ **Procesamiento automático:** Se ejecuta cuando hay `fileUrl`
- ✅ **Estado reactivo:** Devuelve estado, progreso y resultados
- ✅ **Mismo motor:** Usa Tesseract.js en el cliente

**Uso:**
```typescript
const { isProcessing, progress, status, result } = useAutoOCR({
  fileUrl: fileUrl,
  onOCRComplete: (result) => {...},
  autoProcess: true
});
```

---

## 🔄 Flujos de Procesamiento

### **Flujo 1: Factura desde WhatsApp (Kapso)**
```
1. Webhook recibe documento de WhatsApp
2. processKapsoDocumentWithOCR()
3. Crea documento en BD
4. documentService.processDocumentWithOCR()
5. ocrService.extractTextFromPDF()
6. simpleInvoiceExtraction.extractFromText()
7. Almacena resultados en documento.ocr_data
8. createOrderFromInvoice() (si no hay orden)
9. Actualiza orden con datos extraídos
```

### **Flujo 2: Factura desde WhatsApp (Webhook directo)**
```
1. Webhook recibe documento
2. processWhatsAppDocument()
3. Sube archivo a Storage
4. Crea documento en BD
5. processDocumentWithOCR() (en background)
6. Mismo flujo que Flujo 1 desde paso 5
```

### **Flujo 3: Upload manual de factura**
```
1. Usuario sube archivo
2. InvoiceOCRProcessor (cliente) o API route
3. Procesa con OCR
4. Extrae datos
5. Crea/actualiza orden
```

---

## 🎯 Datos Extraídos

### **Campos Principales:**
- ✅ **Número de factura:** Múltiples formatos soportados
- ✅ **Monto total:** Formatos argentinos e internacionales
- ✅ **Moneda:** Detecta ARS, USD, etc. (default: ARS)
- ✅ **Fechas:** Emisión y vencimiento
- ✅ **Proveedor:** Nombre y CUIT
- ✅ **Items:** Descripción, cantidad, precio unitario, total

### **Campos Secundarios:**
- ✅ **Subtotal:** Si está disponible
- ✅ **Impuestos:** IVA u otros
- ✅ **Texto completo:** Texto crudo extraído por OCR
- ✅ **Confianza:** Score de confianza (0-1)

---

## ⚙️ Configuración y Optimizaciones

### **Tesseract.js:**
- **Idiomas:** Español + Inglés (`spa+eng`)
- **Whitelist:** Caracteres permitidos optimizados para facturas
- **Segmentación:** Modo columna única
- **Preprocessing:** Sharp para mejorar calidad

### **Patrones Regex:**
- **Montos:** Múltiples formatos (argentino, internacional)
- **Fechas:** DD/MM/YYYY, YYYY-MM-DD
- **CUIT:** Con y sin guiones
- **Items:** Múltiples formatos de tabla

### **Confianza:**
- **Cálculo:** Basado en campos extraídos
- **Pesos:** Diferentes pesos por campo (monto total tiene más peso)
- **Rango:** 0-1 (0 = sin datos, 1 = todos los datos extraídos)

---

## 📊 Métricas y Logging

### **Logs Generados:**
- ✅ Progreso de OCR (porcentaje)
- ✅ Tiempo de procesamiento
- ✅ Confianza del OCR
- ✅ Campos extraídos
- ✅ Errores y advertencias

### **Métricas Disponibles:**
- `processingTime`: Tiempo total de procesamiento
- `confidence`: Confianza del OCR (0-100)
- `confidence_score`: Confianza de extracción (0-1)
- `pageCount`: Número de páginas procesadas
- `method`: Método usado (`pdf-parse` o `tesseract`)

---

## 🔧 Mejoras y Optimizaciones Futuras

### **Posibles Mejoras:**
1. **IA/ML:** Integrar modelos de ML para mejor extracción
2. **Validación:** Validar datos extraídos contra AFIP
3. **Cache:** Cachear resultados de OCR para documentos similares
4. **Paralelización:** Procesar múltiples páginas en paralelo
5. **Mejores patrones:** Aprender patrones de facturas comunes

---

## 📝 Notas Técnicas

### **Dependencias Principales:**
- `tesseract.js`: OCR en cliente y servidor
- `pdf-parse`: Extracción de texto de PDFs nativos
- `sharp`: Preprocessing de imágenes
- `@supabase/supabase-js`: Almacenamiento

### **Limitaciones Conocidas:**
- OCR puede ser lento en documentos grandes
- Calidad depende de la calidad de la imagen/PDF
- Patrones regex pueden fallar con formatos no estándar
- Items complejos pueden no extraerse correctamente

### **Mejores Prácticas:**
- Usar `pdf-parse` primero (más rápido)
- Aplicar preprocessing antes de Tesseract
- Validar datos extraídos antes de usar
- Guardar texto crudo para debugging

---

## 🎓 Conclusión

El sistema OCR implementado es **robusto y multi-capa**, con:
- ✅ Extracción de texto confiable (dual strategy)
- ✅ Extracción de datos estructurados avanzada
- ✅ Soporte para múltiples formatos de facturas
- ✅ Procesamiento tanto en cliente como servidor
- ✅ Integración completa con el flujo de órdenes

El sistema está diseñado para ser **escalable y mantenible**, con servicios separados que pueden mejorarse independientemente.

