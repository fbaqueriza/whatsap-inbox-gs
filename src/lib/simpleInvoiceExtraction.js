/**
 * 🧾 SERVICIO SIMPLE DE EXTRACCIÓN DE DATOS DE FACTURAS
 * 
 * Versión simplificada sin TypeScript para extraer datos básicos
 */

class SimpleInvoiceExtraction {
  constructor() {
    if (SimpleInvoiceExtraction.instance) {
      return SimpleInvoiceExtraction.instance;
    }
    SimpleInvoiceExtraction.instance = this;
  }

  static getInstance() {
    if (!SimpleInvoiceExtraction.instance) {
      SimpleInvoiceExtraction.instance = new SimpleInvoiceExtraction();
    }
    return SimpleInvoiceExtraction.instance;
  }

  /**
   * 🔍 EXTRAER DATOS DE FACTURA DESDE TEXTO
   */
  async extractFromText(text, fileName) {
    try {
      console.log('🔍 [SimpleInvoiceExtraction] Iniciando extracción desde texto');
      console.log('📄 [SimpleInvoiceExtraction] Texto a procesar:', text.substring(0, 200) + '...');

      const invoiceData = {
        extractedText: text
      };

      // 1. Buscar número de factura
      invoiceData.invoiceNumber = this.extractInvoiceNumber(text);
      
      // 2. Buscar monto total
      invoiceData.totalAmount = this.extractTotalAmount(text);
      
      // 3. Buscar moneda
      invoiceData.currency = this.extractCurrency(text);
      
      // 4. Buscar fechas
      invoiceData.issueDate = this.extractIssueDate(text);
      
      // 5. Buscar CUIT
      invoiceData.providerTaxId = this.extractProviderTaxId(text);
      
      // 6. Buscar nombre del proveedor
      invoiceData.providerName = this.extractProviderName(text);
      
      // 7. Buscar items/productos
      invoiceData.items = this.extractItems(text);

      // Calcular confianza
      const confidence = this.calculateConfidence(invoiceData);

      console.log('✅ [SimpleInvoiceExtraction] Extracción completada:', {
        invoiceNumber: invoiceData.invoiceNumber,
        totalAmount: invoiceData.totalAmount,
        currency: invoiceData.currency,
        issueDate: invoiceData.issueDate,
        providerTaxId: invoiceData.providerTaxId,
        itemsCount: invoiceData.items ? invoiceData.items.length : 0,
        confidence: confidence
      });

      return {
        success: true,
        data: invoiceData,
        confidence: confidence
      };

    } catch (error) {
      console.error('❌ [SimpleInvoiceExtraction] Error en extracción:', error);
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
      /(?:comp\.?\s*nro|comprobante\s*nro|factura\s*nro)[\s\:\-]*(\d+)/i,
      /(?:número|numero)[\s\:\-]*(\d{4,})/i,
      /(?:n[º°]|numero|number)[\s\:\-]*([A-Z0-9\-]+)/i,
      /comp\.?\s*nro:\s*(\d+)/i,
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
    console.log('🔍 [SimpleInvoiceExtraction] Extrayendo monto total...');
    console.log('📄 [SimpleInvoiceExtraction] Texto completo para análisis:', text);
    
    const patterns = [
      // PRIORIDAD ALTA: Patrón específico para "Monto: $12345" - captura el monto completo después del $
      /(?:monto)[\s\:\-]*\$([0-9,\.]+)/i,
      // PRIORIDAD ALTA: Patrón específico para "Total: $15000" - captura el monto completo después del $
      /(?:total)[\s\:\-]*\$([0-9,\.]+)/i,
      // PRIORIDAD ALTA: Patrón para "Importe Total: $15000"
      /(?:importe total)[\s\:\-]*\$([0-9,\.]+)/i,
      // Patrones específicos para facturas argentinas
      /(?:total a pagar|total general)[\s\:\-]*\$([0-9,\.]+)/i,
      /(?:suma total)[\s\:\-]*\$([0-9,\.]+)/i,
      // Patrón genérico para cualquier monto con $ (mejorado para capturar números largos)
      /\$([0-9]+(?:[.,][0-9]+)*)/i,
      // Patrón para montos sin $ pero con "Total"
      /(?:total)[\s\:\-]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/i,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches[1]) {
        const amount = this.parseAmount(matches[1]);
        console.log('🔍 [SimpleInvoiceExtraction] Monto encontrado:', {
          pattern: pattern.source,
          match: matches[1],
          parsed: amount,
          fullMatch: matches[0]
        });
        if (amount > 0) { // Cualquier monto positivo es válido
          console.log('✅ [SimpleInvoiceExtraction] Monto válido encontrado:', amount);
          return amount;
        }
      }
    }

    console.log('⚠️ [SimpleInvoiceExtraction] No se encontró monto total');
    return undefined;
  }

  /**
   * 💱 EXTRAER MONEDA
   */
  extractCurrency(text) {
    console.log('🔍 [SimpleInvoiceExtraction] Extrayendo moneda...');
    
    // Para facturas argentinas, siempre es ARS
    // Solo buscar explícitamente otras monedas, pero por defecto ARS
    const patterns = [
      /(?:moneda|currency)[\s\:\-]*([A-Z]{3})/i,
      /\$([A-Z]{3})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const currency = match[1].toUpperCase();
        // Si es una moneda válida y no es una palabra común, usarla
        if (currency !== 'BEE' && currency !== 'FACTURA' && currency.length === 3) {
          console.log('✅ [SimpleInvoiceExtraction] Moneda encontrada:', currency);
          return currency;
        }
      }
    }

    // Si encuentra "ARS" explícitamente en el texto
    if (/ARS/i.test(text)) {
      console.log('✅ [SimpleInvoiceExtraction] ARS encontrado explícitamente en texto');
      return 'ARS';
    }

    // Para facturas argentinas, por defecto siempre es ARS
    console.log('✅ [SimpleInvoiceExtraction] Usando ARS por defecto para facturas argentinas');
    return 'ARS';
  }

  /**
   * 📅 EXTRAER FECHA DE EMISIÓN
   */
  extractIssueDate(text) {
    const patterns = [
      // Patrón que busca la fecha en la misma línea
      /(?:fecha|date|emision)[\s:\-]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      // Patrón para formatos YYYY/MM/DD
      /(?:fecha)[\s:\-]*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
      // Patrón que busca "Fecha de Emisión:" seguido de fecha en línea siguiente
      /(?:fecha[\s]+de[\s]+emisi[oó]n)[\s:\-]*\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const normalized = this.normalizeDate(match[1]);
        if (normalized) {
          console.log('✅ [SimpleInvoiceExtraction] Fecha extraída:', match[1], '→', normalized);
          return normalized;
        }
      }
    }

    console.log('⚠️ [SimpleInvoiceExtraction] No se encontró fecha de emisión');
    return undefined;
  }

  /**
   * 🆔 EXTRAER CUIT/CUIL DEL PROVEEDOR
   */
  extractProviderTaxId(text) {
    console.log('🔍 [SimpleInvoiceExtraction] Extrayendo CUIT...');
    
    const patterns = [
      /(?:cuit|cuil|cuit\/cuil)[\s\:\-]*(\d{2}[\-]?\d{8}[\-]?\d{1})/i,
      /(?:cuit)[\s\:\-]*(\d{11})/i, // CUIT sin guiones
      /(?:cuit)[\s\:\-]*(\d{2}[\-]?\d{8}[\-]?\d{1})/i, // CUIT con guiones
      /(\d{11})/i, // Patrón genérico de CUIT de 11 dígitos
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cuit = match[1].replace(/\-/g, '');
        console.log('✅ [SimpleInvoiceExtraction] CUIT encontrado:', cuit);
        return cuit;
      }
    }

    console.log('⚠️ [SimpleInvoiceExtraction] No se encontró CUIT');
    return undefined;
  }

  /**
   * 🏢 EXTRAER NOMBRE DEL PROVEEDOR
   */
  extractProviderName(text) {
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
   * 🔢 PARSEAR MONTO (maneja diferentes formatos)
   */
  parseAmount(amountStr) {
    // Remover símbolos de moneda, espacios y guiones bajos
    let cleanAmount = amountStr.replace(/[\$\s_]/g, '');
    
    console.log('🔍 [SimpleInvoiceExtraction] Parseando monto:', { original: amountStr, clean: cleanAmount });
    
    // Manejar diferentes separadores decimales
    if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
      const lastComma = cleanAmount.lastIndexOf(',');
      const lastDot = cleanAmount.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Coma es decimal: 56.383,10
        cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      } else {
        // Punto es decimal: 1,234.56
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    } else if (cleanAmount.includes(',')) {
      // Solo coma: analizar si es decimal o separador de miles
      const parts = cleanAmount.split(',');
      
      // Si hay exactamente 2 partes y la segunda tiene 1-2 dígitos, es decimal
      if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) {
        // Es decimal: 56383,10
        cleanAmount = cleanAmount.replace(',', '.');
      } else {
        // Es separador de miles: 1,234,567
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    }

    const result = parseFloat(cleanAmount) || 0;
    console.log('🔍 [SimpleInvoiceExtraction] Monto parseado:', { clean: cleanAmount, result });
    return result;
  }

  /**
   * 📅 NORMALIZAR FECHA
   */
  normalizeDate(dateStr) {
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
      console.warn('⚠️ [SimpleInvoiceExtraction] Fecha inválida, usando fecha actual:', dateStr);
      const today = new Date();
      return today.toISOString().split('T')[0];
      
    } catch (error) {
      console.error('❌ [SimpleInvoiceExtraction] Error normalizando fecha:', error);
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
  }

  /**
   * 📦 EXTRAER ITEMS/PRODUCTOS
   */
  extractItems(text) {
    console.log('🔍 [SimpleInvoiceExtraction] Extrayendo items de la factura...');
    
    const items = [];
    const lines = text.split('\n');
    console.log(`📄 [SimpleInvoiceExtraction] Total líneas del texto: ${lines.length}`);
    
    // Patrones mejorados para identificar líneas de items
    const itemPatterns = [
      // Patrón con separadores: descripción | cantidad | precio | total
      /^(.{10,80}?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*\|\s*\$?\s*([\d,\.]+)\s*\|\s*\$?\s*([\d,\.]+)$/i,
      // Patrón genérico: descripción cantidad precio total
      /^(.{10,80}?)\s+(\d+(?:[.,]\d+)?)\s+\$?\s*([\d,\.]+)\s+\$?\s*([\d,\.]+)$/i,
      // Patrón con dos campos: descripción + monto
      /^(.{10,80}?)\s+\$?\s*([\d,\.]+)$/i,
      // Patrón con tres campos: descripción + cantidad + monto
      /^(.{10,80}?)\s+(\d+(?:[.,]\d+)?)\s+\$?\s*([\d,\.]+)$/i,
    ];
    
    // Buscar líneas que parecen ser items
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip líneas que claramente no son items
      if (!trimmedLine || trimmedLine.length < 5) continue;
      if (/^(total|subtotal|descuento|iva|importe|neto|base|impuesto)/i.test(trimmedLine)) continue;
      if (/^(factura|comprobante|fecha|numero|cliente|proveedor|razon social)/i.test(trimmedLine)) continue;
      if (/^(codigo|cod\.|cantidad|cant\.|precio|unit\.|importe)$/i.test(trimmedLine)) continue; // Headers de tabla
      if (/^[0-9\-]+$/.test(trimmedLine)) continue; // Solo números (posible CUIT o fecha)
      
      // Intentar matchar con los patrones
      for (let i = 0; i < itemPatterns.length; i++) {
        const pattern = itemPatterns[i];
        const match = trimmedLine.match(pattern);
        
        if (match && match[1]) {
          const description = match[1].trim();
          
          // Para patrones de 4 campos (desc + qty + price + total)
          if (match.length === 5) {
            const quantity = parseFloat(match[2].replace(',', '.')) || 1;
            const unitPrice = this.parseAmount(match[3]);
            const total = this.parseAmount(match[4]);
            
            // Validar que los valores sean razonables
            if (description.length >= 3 && unitPrice > 0 && total > 0) {
              items.push({
                description: description,
                quantity: quantity,
                unitPrice: unitPrice,
                total: total || (unitPrice * quantity)
              });
              console.log('✅ [SimpleInvoiceExtraction] Item extraído (4 campos):', {
                description: description,
                quantity: quantity,
                unitPrice: unitPrice,
                total: total
              });
              break;
            }
          }
          // Para patrones de 3 campos (desc + qty + monto)
          else if (match.length === 4) {
            const quantity = parseFloat(match[2].replace(',', '.')) || 1;
            const total = this.parseAmount(match[3]);
            
            // Validar que los valores sean razonables
            if (description.length >= 3 && total > 0) {
              const unitPrice = total / quantity;
              items.push({
                description: description,
                quantity: quantity,
                unitPrice: unitPrice,
                total: total
              });
              console.log('✅ [SimpleInvoiceExtraction] Item extraído (3 campos):', {
                description: description,
                quantity: quantity,
                unitPrice: unitPrice,
                total: total
              });
              break;
            }
          }
          // Para patrones de 2 campos (desc + monto)
          else if (match.length === 3) {
            const total = this.parseAmount(match[2]);
            
            // Validar que los valores sean razonables
            if (description.length >= 3 && total > 0) {
              items.push({
                description: description,
                quantity: 1,
                unitPrice: total,
                total: total
              });
              console.log('✅ [SimpleInvoiceExtraction] Item extraído (2 campos):', {
                description: description,
                quantity: 1,
                unitPrice: total,
                total: total
              });
              break;
            }
          }
        }
      }
    }
    
    console.log(`📦 [SimpleInvoiceExtraction] Items extraídos: ${items.length}`);
    return items.length > 0 ? items : undefined;
  }

  /**
   * 📊 CALCULAR CONFIANZA DE LA EXTRACCIÓN
   */
  calculateConfidence(data) {
    let score = 0;
    let maxScore = 0;

    // Cada campo tiene un peso diferente
    const weights = {
      invoiceNumber: 0.2,
      totalAmount: 0.3,
      currency: 0.1,
      issueDate: 0.1,
      providerName: 0.1,
      providerTaxId: 0.2
    };

    for (const [field, weight] of Object.entries(weights)) {
      maxScore += weight;
      
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        score += weight;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }
}

// Exportar instancia singleton
const simpleInvoiceExtraction = SimpleInvoiceExtraction.getInstance();

module.exports = {
  simpleInvoiceExtraction
};
