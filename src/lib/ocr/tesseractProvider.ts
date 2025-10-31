import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';

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
  // Fallback a Tesseract
  const { data } = await Tesseract.recognize(buffer, 'spa');
  return { text: data.text || '', meta: { engine: 'tesseract' } };
}


