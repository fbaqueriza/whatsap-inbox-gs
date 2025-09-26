/**
 * Servicio de extracción de datos de comprobantes de pago
 * Extrae información de transferencias, cheques, comprobantes de pago, etc.
 */

export function extractPaymentData(text) {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      error: 'No se proporcionó texto para procesar'
    };
  }

  console.log('🔍 [PaymentExtraction] Procesando texto:', text.substring(0, 200) + '...');

  const extractedData = {
    paymentAmount: null,
    paymentDate: null,
    paymentMethod: null,
    receiptNumber: null,
    bankName: null,
    accountNumber: null,
    beneficiaryName: null,
    currency: 'ARS',
    confidence: 0
  };

  let confidence = 0;

  // 1. Extraer monto del pago
  const amountPatterns = [
    /(?:monto|importe|total|valor|pago)[\s:]*\$?\s*([\d.,]+)/i,
    /\$?\s*([\d.,]+)\s*(?:pesos|ars|usd)/i,
    /(?:transferencia|transferido)[\s:]*\$?\s*([\d.,]+)/i,
    /(?:cheque|cheque n)[\s:]*\$?\s*([\d.,]+)/i
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount > 0) {
        extractedData.paymentAmount = amount;
        confidence += 0.3;
        console.log('💰 [PaymentExtraction] Monto encontrado:', amount);
        break;
      }
    }
  }

  // 2. Extraer fecha del pago
  const datePatterns = [
    /(?:fecha|date)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        extractedData.paymentDate = date;
        confidence += 0.2;
        console.log('📅 [PaymentExtraction] Fecha encontrada:', date);
        break;
      }
    }
  }

  // 3. Detectar método de pago
  if (text.toLowerCase().includes('transferencia') || text.toLowerCase().includes('transfer')) {
    extractedData.paymentMethod = 'transferencia';
    confidence += 0.2;
  } else if (text.toLowerCase().includes('cheque')) {
    extractedData.paymentMethod = 'cheque';
    confidence += 0.2;
  } else if (text.toLowerCase().includes('efectivo') || text.toLowerCase().includes('cash')) {
    extractedData.paymentMethod = 'efectivo';
    confidence += 0.2;
  } else if (text.toLowerCase().includes('tarjeta') || text.toLowerCase().includes('card')) {
    extractedData.paymentMethod = 'tarjeta';
    confidence += 0.2;
  } else {
    extractedData.paymentMethod = 'other';
  }

  // 4. Extraer número de comprobante
  const receiptPatterns = [
    /(?:comprobante|recibo|voucher)[\s:]*n[°º]?\s*(\d+)/i,
    /(?:numero|n[°º]?)[\s:]*(\d{6,})/i,
    /(?:referencia|ref)[\s:]*(\d+)/i
  ];

  for (const pattern of receiptPatterns) {
    const match = text.match(pattern);
    if (match) {
      extractedData.receiptNumber = match[1];
      confidence += 0.1;
      console.log('📄 [PaymentExtraction] Número de comprobante encontrado:', match[1]);
      break;
    }
  }

  // 5. Extraer nombre del banco
  const bankPatterns = [
    /(?:banco|bank)[\s:]*([a-zA-Z\s]+)/i,
    /(?:entidad|entity)[\s:]*([a-zA-Z\s]+)/i
  ];

  for (const pattern of bankPatterns) {
    const match = text.match(pattern);
    if (match) {
      extractedData.bankName = match[1].trim();
      confidence += 0.1;
      console.log('🏦 [PaymentExtraction] Banco encontrado:', match[1]);
      break;
    }
  }

  // 6. Extraer número de cuenta
  const accountPatterns = [
    /(?:cuenta|account)[\s:]*(\d+)/i,
    /(?:cbu|cvu)[\s:]*(\d+)/i
  ];

  for (const pattern of accountPatterns) {
    const match = text.match(pattern);
    if (match) {
      extractedData.accountNumber = match[1];
      confidence += 0.1;
      console.log('💳 [PaymentExtraction] Número de cuenta encontrado:', match[1]);
      break;
    }
  }

  // 7. Extraer nombre del beneficiario
  const beneficiaryPatterns = [
    /(?:beneficiario|beneficiary|a favor de)[\s:]*([a-zA-Z\s]+)/i,
    /(?:destinatario|recipient)[\s:]*([a-zA-Z\s]+)/i
  ];

  for (const pattern of beneficiaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      extractedData.beneficiaryName = match[1].trim();
      confidence += 0.1;
      console.log('👤 [PaymentExtraction] Beneficiario encontrado:', match[1]);
      break;
    }
  }

  extractedData.confidence = Math.min(confidence, 1.0);

  console.log('✅ [PaymentExtraction] Datos extraídos:', extractedData);

  return {
    success: true,
    data: extractedData
  };
}

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  
  // Limpiar el string y convertir a número
  const cleanAmount = amountStr.replace(/[^\d.,]/g, '');
  
  // Manejar diferentes formatos de decimales
  if (cleanAmount.includes(',')) {
    // Formato argentino: 1.234,56
    const parts = cleanAmount.split(',');
    if (parts.length === 2) {
      const integerPart = parts[0].replace(/\./g, '');
      const decimalPart = parts[1];
      return parseFloat(integerPart + '.' + decimalPart);
    }
  }
  
  return parseFloat(cleanAmount.replace(/\./g, '')) || 0;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Intentar diferentes formatos de fecha
    const formats = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, // DD/MM/YYYY
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/,  // DD/MM/YY
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let day = parseInt(match[1]);
        let month = parseInt(match[2]);
        let year = parseInt(match[3]);
        
        // Ajustar año de 2 dígitos
        if (year < 100) {
          year += 2000;
        }
        
        // Validar fecha
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  
  return null;
}
