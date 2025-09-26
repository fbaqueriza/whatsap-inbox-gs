'use client';

import React, { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface OCRResult {
  text: string;
  confidence: number;
  extractedData: {
    invoiceNumber?: string;
    totalAmount?: number;
    invoiceDate?: string;
    cuit?: string;
  };
}

interface InvoiceOCRProcessorProps {
  fileUrl: string;
  onOCRComplete: (result: OCRResult) => void;
  onError: (error: string) => void;
}

export default function InvoiceOCRProcessor({ 
  fileUrl, 
  onOCRComplete, 
  onError 
}: InvoiceOCRProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  // 🔧 NUEVO: Función para parsear texto extraído y encontrar datos específicos
  const parseInvoiceText = useCallback((text: string): OCRResult['extractedData'] => {
    console.log('📄 Texto extraído por OCR:', text.substring(0, 500) + '...');

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
    let extractedData: OCRResult['extractedData'] = {};

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

  // 🔧 NUEVO: Función principal de procesamiento OCR
  const processInvoiceWithOCR = useCallback(async () => {
    if (!fileUrl) {
      onError('No hay archivo para procesar');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('Iniciando procesamiento OCR...');

    try {
      console.log('🔍 Iniciando extracción OCR con Tesseract en el cliente...');
      
      // 🔧 OCR: Procesar imagen/PDF con Tesseract en el cliente
      const { data: { text, confidence } } = await Tesseract.recognize(
        fileUrl,
        'spa', // Español
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              const progressPercent = Math.round(m.progress * 100);
              setProgress(progressPercent);
              setStatus(`Procesando texto... ${progressPercent}%`);
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

      console.log('📄 Texto extraído por OCR:', text.substring(0, 500) + '...');
      console.log('🎯 Confianza OCR:', confidence);

      setStatus('Extrayendo datos específicos...');

      // 🔧 PARSING: Extraer datos específicos del texto
      const extractedData = parseInvoiceText(text);
      
      const result: OCRResult = {
        text,
        confidence,
        extractedData
      };

      console.log('📄 Datos extraídos de factura:', result);
      
      setStatus('Procesamiento completado');
      onOCRComplete(result);

    } catch (error) {
      console.error('Error procesando factura con OCR:', error);
      onError(`Error en OCR: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setStatus('');
    }
  }, [fileUrl, parseInvoiceText, onOCRComplete, onError]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <FileText className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-medium text-gray-900">Procesamiento OCR de Factura</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Procesa la factura usando OCR para extraer automáticamente el número, monto, fecha y CUIT.
        </p>

        {isProcessing && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600">{status}</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-500">
              {progress}% completado
            </p>
          </div>
        )}

        <button
          onClick={processInvoiceWithOCR}
          disabled={isProcessing || !fileUrl}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span>Procesar con OCR</span>
            </>
          )}
        </button>

        <div className="text-xs text-gray-500">
          <p>• El procesamiento se realiza en tu navegador</p>
          <p>• No se envían datos a servidores externos</p>
          <p>• Puede tomar 10-30 segundos dependiendo del archivo</p>
        </div>
      </div>
    </div>
  );
}
