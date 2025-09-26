/**
 * 🧾 SERVICIO DE EXTRACCIÓN DE DATOS DE FACTURAS
 * 
 * Este servicio maneja la extracción de datos importantes de facturas PDF
 * como montos, fechas, números de factura, etc.
 */

/**
 * Datos de factura extraídos
 */
// interface InvoiceData {
//   invoiceNumber?: string;
//   totalAmount?: number;
//   subtotal?: number;
//   tax?: number;
//   currency?: string;
//   issueDate?: string;
//   dueDate?: string;
//   providerName?: string;
//   providerTaxId?: string;
//   items?: Array<{
//     description: string;
//     quantity: number;
//     unitPrice: number;
//     total: number;
//   }>;
//   extractedText?: string;
// }

// interface ExtractionResult {
//   success: boolean;
//   data?: InvoiceData;
//   error?: string;
//   confidence?: number; // 0-1, qué tan confiable es la extracción
// }

class InvoiceExtractionService {
  constructor() {
    if (InvoiceExtractionService.instance) {
      return InvoiceExtractionService.instance;
    }
    InvoiceExtractionService.instance = this;
  }

  static getInstance() {
    if (!InvoiceExtractionService.instance) {
      InvoiceExtractionService.instance = new InvoiceExtractionService();
    }
    return InvoiceExtractionService.instance;
  }

  /**
   * 🔍 EXTRAER DATOS DE FACTURA DESDE TEXTO
   * 
   * @param text - Texto extraído del PDF
   * @param fileName - Nombre del archivo (opcional, para contexto)
   * @returns Datos extraídos de la factura
   */
  async extractFromText(text: string, fileName?: string): Promise<ExtractionResult> {
    try {
      console.log('🔍 [InvoiceExtraction] Iniciando extracción desde texto');
      console.log('📄 [InvoiceExtraction] Texto a procesar:', text.substring(0, 200) + '...');

      const invoiceData: InvoiceData = {
        extractedText: text
      };

      // 🔍 PATRONES DE BÚSQUEDA PARA DIFERENTES TIPOS DE FACTURAS
      
      // 1. Buscar número de factura
      invoiceData.invoiceNumber = this.extractInvoiceNumber(text);
      
      // 2. Buscar monto total
      invoiceData.totalAmount = this.extractTotalAmount(text);
      
      // 3. Buscar subtotal
      invoiceData.subtotal = this.extractSubtotal(text);
      
      // 4. Buscar impuestos
      invoiceData.tax = this.extractTax(text);
      
      // 5. Buscar moneda
      invoiceData.currency = this.extractCurrency(text);
      
      // 6. Buscar fechas
      invoiceData.issueDate = this.extractIssueDate(text);
      invoiceData.dueDate = this.extractDueDate(text);
      
      // 7. Buscar datos del proveedor
      invoiceData.providerName = this.extractProviderName(text);
      invoiceData.providerTaxId = this.extractProviderTaxId(text);
      
      // 8. Buscar items/productos
      invoiceData.items = this.extractItems(text);

      // 🔍 CALCULAR CONFIANZA
      const confidence = this.calculateConfidence(invoiceData);

      console.log('✅ [InvoiceExtraction] Extracción completada:', {
        invoiceNumber: invoiceData.invoiceNumber,
        totalAmount: invoiceData.totalAmount,
        currency: invoiceData.currency,
        confidence: confidence
      });

      return {
        success: true,
        data: invoiceData,
        confidence: confidence
      };

    } catch (error) {
      console.error('❌ [InvoiceExtraction] Error en extracción:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en extracción'
      };
    }
  }

  /**
   * 🔍 EXTRAER NÚMERO DE FACTURA
   */
  extractInvoiceNumber(text) {
    const patterns = [
      /(?:número|numero)[\s\:\-]*(\d{4}[\-]\d{4})/i, // Patrón como 0001-1234 - PRIORITARIO
      /(?:n[º°]|numero|number)[\s\:\-]*([A-Z0-9\-]+)/i,
      /(?:ref|referencia)[\s\:\-]*([A-Z0-9\-]+)/i,
      /^([A-Z]{2,4}[\-]?\d{4,8})/m, // Patrón como ABC-123456
      /(?:factura|invoice|comprobante)[\s\:\-]*([A-Z0-9\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 💰 EXTRAER MONTO TOTAL
   */
  extractTotalAmount(text) {
    console.log('🔍 [InvoiceExtraction] Extrayendo monto total del texto...');
    
    const patterns = [
      // Patrones específicos para facturas argentinas
      /(?:importe total|total a pagar|total general)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
      /(?:total)[\s\:\-]*\$?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i,
      /(?:total|importe)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
      /(?:suma total)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
      // Patrón para "Total: $15000"
      /(?:total)[\s\:\-]*\$(\d+)/i,
      // Patrón para montos con formato argentino
      /\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/i,
      // Patrón para números grandes
      /\b([0-9]{4,})\b/g,
    ];

    console.log('📄 [InvoiceExtraction] Texto a analizar:', text.substring(0, 300) + '...');

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches[1]) {
        const amount = this.parseAmount(matches[1]);
        console.log('🔍 [InvoiceExtraction] Monto encontrado con patrón:', {
          pattern: pattern.source,
          match: matches[1],
          parsed: amount
        });
        if (amount > 0 && amount < 1000000) { // Rango razonable para facturas
          console.log('✅ [InvoiceExtraction] Monto válido encontrado:', amount);
          return amount;
        }
      }
    }

    console.log('⚠️ [InvoiceExtraction] No se encontró monto total válido');
    return undefined;
  }

  /**
   * 📊 EXTRAER SUBTOTAL
   */
  extractSubtotal(text) {
    const patterns = [
      /(?:subtotal|sub total)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
      /(?:neto|base imponible)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = this.parseAmount(match[1]);
        if (amount > 0) {
          return amount;
        }
      }
    }

    return undefined;
  }

  /**
   * 🏛️ EXTRAER IMPUESTOS
   */
  private extractTax(text: string): number | undefined {
    const patterns = [
      /(?:iva|impuesto|tax)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
      /(?:21%|iva 21)[\s\:\-]*\$?\s*([0-9,\.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = this.parseAmount(match[1]);
        if (amount > 0) {
          return amount;
        }
      }
    }

    return undefined;
  }

  /**
   * 💱 EXTRAER MONEDA
   */
  private extractCurrency(text: string): string | undefined {
    console.log('🔍 [InvoiceExtraction] Extrayendo moneda del texto:', text.substring(0, 100) + '...');
    
    const patterns = [
      /(?:moneda|currency)[\s\:\-]*([A-Z]{3})/i, // Moneda: ARS, Currency: USD
      /\$([A-Z]{3})/i, // $ARS, $USD
      /\b([A-Z]{3})\b/i, // ARS, USD (palabras completas)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        console.log('✅ [InvoiceExtraction] Moneda encontrada con patrón:', match[1]);
        return match[1].toUpperCase();
      }
    }

    // Si encuentra "ARS" en el texto, devolver ARS
    if (/ARS/i.test(text)) {
      console.log('✅ [InvoiceExtraction] ARS encontrado en texto, devolviendo ARS');
      return 'ARS';
    }

    // Default a ARS si no se encuentra
    console.log('⚠️ [InvoiceExtraction] No se encontró moneda, usando default ARS');
    return 'ARS';
  }

  /**
   * 📅 EXTRAER FECHA DE EMISIÓN
   */
  private extractIssueDate(text: string): string | undefined {
    const patterns = [
      /(?:fecha|date|emision)[\s\:\-]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:fecha)[\s\:\-]*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.normalizeDate(match[1]);
      }
    }

    return undefined;
  }

  /**
   * 📅 EXTRAER FECHA DE VENCIMIENTO
   */
  private extractDueDate(text: string): string | undefined {
    const patterns = [
      /(?:vencimiento|due date|due)[\s\:\-]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:vencimiento)[\s\:\-]*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.normalizeDate(match[1]);
      }
    }

    return undefined;
  }

  /**
   * 🏢 EXTRAER NOMBRE DEL PROVEEDOR
   */
  private extractProviderName(text: string): string | undefined {
    // Buscar en las primeras líneas del documento
    const lines = text.split('\n').slice(0, 10);
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Patrones comunes para nombres de empresas
      if (trimmedLine.length > 3 && trimmedLine.length < 50) {
        // Excluir líneas que parecen ser direcciones o números
        if (!/^\d+/.test(trimmedLine) && 
            !/\d{4,}/.test(trimmedLine) && 
            !trimmedLine.includes('@') &&
            !trimmedLine.includes('www.')) {
          return trimmedLine;
        }
      }
    }

    return undefined;
  }

  /**
   * 🆔 EXTRAER CUIT/CUIL DEL PROVEEDOR
   */
  private extractProviderTaxId(text: string): string | undefined {
    console.log('🔍 [InvoiceExtraction] Extrayendo CUIT del texto...');
    
    const patterns = [
      /(?:cuit|cuil|cuit\/cuil)[\s\:\-]*(\d{2}[\-]?\d{8}[\-]?\d{1})/i,
      /(\d{2}[\-]?\d{8}[\-]?\d{1})/i, // Patrón genérico de CUIT
      /(?:cuit)[\s\:\-]*(\d{11})/i, // CUIT sin guiones
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cuit = match[1].replace(/\-/g, '');
        console.log('✅ [InvoiceExtraction] CUIT encontrado:', cuit);
        return cuit;
      }
    }

    console.log('⚠️ [InvoiceExtraction] No se encontró CUIT en el texto');
    return undefined;
  }

  /**
   * 📦 EXTRAER ITEMS/PRODUCTOS
   */
  private extractItems(text: string): Array<{description: string; quantity: number; unitPrice: number; total: number}> | undefined {
    // Esta es una implementación básica
    // En un sistema real, esto sería más complejo
    
    const items: Array<{description: string; quantity: number; unitPrice: number; total: number}> = [];
    
    // Buscar líneas que parecen ser items
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Patrón básico: descripción cantidad precio total
      const itemPattern = /(.+?)\s+(\d+(?:[.,]\d+)?)\s+\$?([0-9,\.]+)\s+\$?([0-9,\.]+)/i;
      const match = line.match(itemPattern);
      
      if (match) {
        items.push({
          description: match[1].trim(),
          quantity: parseFloat(match[2].replace(',', '.')),
          unitPrice: this.parseAmount(match[3]),
          total: this.parseAmount(match[4])
        });
      }
    }

    return items.length > 0 ? items : undefined;
  }

  /**
   * 🔢 PARSEAR MONTO (maneja diferentes formatos)
   */
  private parseAmount(amountStr: string): number {
    // Remover símbolos de moneda y espacios
    let cleanAmount = amountStr.replace(/[\$\s]/g, '');
    
    console.log('🔍 [InvoiceExtraction] Parseando monto:', { original: amountStr, clean: cleanAmount });
    
    // Manejar diferentes separadores decimales
    // Si tiene coma y punto, el último es decimal
    if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
      const lastComma = cleanAmount.lastIndexOf(',');
      const lastDot = cleanAmount.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Coma es decimal: 1.234,56
        cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      } else {
        // Punto es decimal: 1,234.56
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    } else if (cleanAmount.includes(',')) {
      // Solo coma: podría ser decimal o separador de miles
      const parts = cleanAmount.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Es decimal: 1234,56
        cleanAmount = cleanAmount.replace(',', '.');
      } else {
        // Es separador de miles: 1,234,567
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    }

    const result = parseFloat(cleanAmount) || 0;
    console.log('🔍 [InvoiceExtraction] Monto parseado:', { clean: cleanAmount, result });
    return result;
  }

  /**
   * 📅 NORMALIZAR FECHA
   */
  private normalizeDate(dateStr: string): string {
    try {
      // Intentar diferentes formatos
      const formats = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // DD/MM/YYYY o DD-MM-YYYY
        /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, // YYYY/MM/DD o YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          let year, month, day;
          
          if (format.source.includes('\\d{4}')) {
            // Formato YYYY/MM/DD o YYYY-MM-DD
            year = match[1];
            month = match[2].padStart(2, '0');
            day = match[3].padStart(2, '0');
          } else {
            // Formato DD/MM/YYYY o DD-MM-YYYY
            day = match[1].padStart(2, '0');
            month = match[2].padStart(2, '0');
            year = match[3];
          }

          // Validar que la fecha sea válida y no futura
          const date = new Date(`${year}-${month}-${day}`);
          const today = new Date();
          
          if (date.getFullYear() == parseInt(year) && 
              date.getMonth() + 1 == parseInt(month) && 
              date.getDate() == parseInt(day) &&
              date <= today) {
            return `${year}-${month}-${day}`;
          }
        }
      }

      // Si no se puede parsear, usar fecha actual
      console.warn('⚠️ [InvoiceExtraction] Fecha inválida, usando fecha actual:', dateStr);
      const today = new Date();
      return today.toISOString().split('T')[0];
      
    } catch (error) {
      console.error('❌ [InvoiceExtraction] Error normalizando fecha:', error);
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
  }

  /**
   * 📊 CALCULAR CONFIANZA DE LA EXTRACCIÓN
   */
  private calculateConfidence(data: InvoiceData): number {
    let score = 0;
    let maxScore = 0;

    // Cada campo tiene un peso diferente
    const weights = {
      invoiceNumber: 0.1,
      totalAmount: 0.3,
      subtotal: 0.1,
      tax: 0.1,
      currency: 0.1,
      issueDate: 0.1,
      providerName: 0.1,
      providerTaxId: 0.1,
      items: 0.1
    };

    for (const [field, weight] of Object.entries(weights)) {
      maxScore += weight;
      
      if (data[field as keyof InvoiceData] !== undefined) {
        score += weight;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }
}

// Exportar instancia singleton
export const invoiceExtractionService = InvoiceExtractionService.getInstance();
