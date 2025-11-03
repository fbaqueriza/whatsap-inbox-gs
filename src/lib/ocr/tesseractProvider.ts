import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';
import sharp from 'sharp';

export interface OcrResult {
  text: string;
  meta?: Record<string, any>;
}

export async function recognizeFromBuffer(buffer: Buffer, mimeType?: string): Promise<OcrResult> {
  // Si es PDF, usa pdf-parse para extraer texto primero (más rápido/estable)
  if (mimeType?.includes('pdf')) {
    try {
      const data = await pdf(buffer);
      if (data.text && data.text.trim().length > 0) {
        return { text: data.text, meta: { engine: 'pdf-parse' } };
      }
    } catch {}
  }
  // Fallback a Tesseract con preprocessing de Sharp
  let processedBuffer = buffer;
  try {
    processedBuffer = await sharp(buffer)
      .greyscale()           // Convertir a escala de grises
      .normalize()           // Normalizar contraste
      .sharpen({             // Mejorar nitidez
        sigma: 0.8,
        flat: 1,
        jagged: 2
      })
      .threshold(128)        // Binarización para OCR
      .toBuffer();
  } catch (preprocessError) {
    console.log('⚠️ [TesseractProvider] Preprocessing falló, usando buffer original');
  }
  
  const { data } = await Tesseract.recognize(processedBuffer, 'spa+eng', {
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÑáéíóúñ.,:$%-/()',
    tessedit_pageseg_mode: '4' // Asumir una sola columna de texto
  });
  return { text: data.text || '', meta: { engine: 'tesseract' } };
}


