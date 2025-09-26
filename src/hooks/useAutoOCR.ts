'use client';

import { useEffect, useCallback, useState } from 'react';
import Tesseract from 'tesseract.js';

interface AutoOCRResult {
  text: string;
  confidence: number;
  extractedData: {
    invoiceNumber?: string;
    totalAmount?: number;
    invoiceDate?: string;
    cuit?: string;
  };
}

interface UseAutoOCRProps {
  fileUrl: string | null;
  onOCRComplete: (result: AutoOCRResult) => void;
  onError: (error: string) => void;
  autoProcess: boolean;
}

export function useAutoOCR({ 
  fileUrl, 
  onOCRComplete, 
  onError, 
  autoProcess = true 
}: UseAutoOCRProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  // 🔧 NUEVO: Función para parsear texto extraído y encontrar datos específicos
  const parseInvoiceText = useCallback((text: string): AutoOCRResult['extractedData'] => {
    console.log('📄 Texto extraído por OCR automático:', text.substring(0, 500) + '...');

    // 🔧 REGEX: Patrones para extraer datos específicos
    const patterns = {
      // Número de factura (varios formatos)
      invoiceNumber: [
        /(?:factura|invoice|n[º°]?[:\s]*)([A-Z0-9\-]+)/i,
        /(?:n[º°]?[:\s]*)([0-9]{4,})/i,
        /(?:comprobante|recibo)[:\s]*([A-Z0-9\-]+)/i
      ],
      
      // Monto total (varios formatos)
      totalAmount: [
        /(?:total|importe|monto)[:\s]*\$?\s*([0-9,\.]+)/i,
        /(?:a\s+pagar|total\s+a\s+pagar)[:\s]*\$?\s*([0-9,\.]+)/i,
        /\$\s*([0-9,\.]+)\s*(?:pesos|ars)?/i
      ],
      
      // Fecha (varios formatos)
      invoiceDate: [
        /(?:fecha|date)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
        /([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/,
        /(?:emisi[óo]n|emitido)[:\s]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i
      ],
      
      // CUIT/CUIL
      cuit: [
        /(?:cuit|cuil)[:\s]*([0-9]{2}[\/\-]?[0-9]{8}[\/\-]?[0-9])/i,
        /([0-9]{2}[\/\-]?[0-9]{8}[\/\-]?[0-9])/
      ]
    };

    // 🔧 EXTRACCIÓN: Buscar cada patrón
    let extractedData: AutoOCRResult['extractedData'] = {};

    // Buscar número de factura
    for (const pattern of patterns.invoiceNumber) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedData.invoiceNumber = match[1].trim();
        break;
      }
    }

    // Buscar monto total
    for (const pattern of patterns.totalAmount) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amountStr = match[1].replace(/[^\d,\.]/g, '').replace(',', '.');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
          extractedData.totalAmount = amount;
          break;
        }
      }
    }

    // Buscar fecha
    for (const pattern of patterns.invoiceDate) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const dateStr = match[1].trim();
        const parsedDate = parseDate(dateStr);
        if (parsedDate) {
          extractedData.invoiceDate = parsedDate.toISOString();
          break;
        }
      }
    }

    // Buscar CUIT
    for (const pattern of patterns.cuit) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedData.cuit = match[1].replace(/[^\d]/g, '');
        break;
      }
    }

    return extractedData;
  }, []);

  // 🔧 NUEVO: Función para parsear fechas en diferentes formatos
  const parseDate = (dateStr: string): Date | null => {
    try {
      // Formato DD/MM/YYYY o DD-MM-YYYY
      const formats = [
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          let day = parseInt(match[1]);
          let month = parseInt(match[2]) - 1; // JavaScript months are 0-based
          let year = parseInt(match[3]);
          
          // Si el año es de 2 dígitos, asumir 20xx
          if (year < 100) {
            year += 2000;
          }

          const date = new Date(year, month, day);
          if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            return date;
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  };

  // 🔧 NUEVO: Función principal de procesamiento OCR automático
  const processInvoiceWithOCR = useCallback(async () => {
    if (!fileUrl || !autoProcess) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus('Iniciando procesamiento OCR automático...');

    try {
      console.log('🔍 Iniciando extracción OCR automática con Tesseract...');
      
      // 🔧 OCR: Procesar imagen/PDF con Tesseract en el cliente
      const { data: { text, confidence } } = await Tesseract.recognize(
        fileUrl,
        'spa', // Español
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              const progressPercent = Math.round(m.progress * 100);
              setProgress(progressPercent);
              setStatus(`Procesando texto automáticamente... ${progressPercent}%`);
            } else if (m.status === 'loading tesseract core') {
              setStatus('Cargando motor OCR...');
            } else if (m.status === 'initializing tesseract') {
              setStatus('Inicializando OCR...');
            } else if (m.status === 'loading language traineddata') {
              setStatus('Cargando modelo de idioma...');
            }
          }
        }
      );

      console.log('📄 Texto extraído por OCR automático:', text.substring(0, 500) + '...');
      console.log('🎯 Confianza OCR automático:', confidence);

      setStatus('Extrayendo datos específicos...');

      // 🔧 PARSING: Extraer datos específicos del texto
      const extractedData = parseInvoiceText(text);
      
      const result: AutoOCRResult = {
        text,
        confidence,
        extractedData
      };

      console.log('📄 Datos extraídos automáticamente:', result);
      
      setStatus('Procesamiento automático completado');
      onOCRComplete(result);

    } catch (error) {
      console.error('Error procesando factura con OCR automático:', error);
      onError(`Error en OCR automático: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setStatus('');
    }
  }, [fileUrl, autoProcess, parseInvoiceText, onOCRComplete, onError]);

  // 🔧 NUEVO: Efecto para procesamiento automático
  useEffect(() => {
    if (fileUrl && autoProcess && !isProcessing) {
      console.log('🚀 Iniciando procesamiento OCR automático para:', fileUrl);
      processInvoiceWithOCR();
    }
  }, [fileUrl, autoProcess, isProcessing, processInvoiceWithOCR]);

  return {
    isProcessing,
    progress,
    status,
    processInvoiceWithOCR
  };
}
