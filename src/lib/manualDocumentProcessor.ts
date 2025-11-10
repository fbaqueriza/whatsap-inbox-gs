/**
 * 🚀 SERVICIO OPTIMIZADO DE PROCESAMIENTO DE DOCUMENTOS MANUALES
 * 
 * Adaptación del sistema optimizado para subidas manuales de facturas.
 * Usa el mismo flujo optimizado pero adaptado para archivos ya subidos.
 */

import { kapsoDocumentProcessor } from './kapsoDocumentProcessor';

interface ManualDocumentData {
  file: File | Buffer;
  filename: string;
  mimeType: string;
  providerId?: string;
  userId: string;
  requestId: string;
  supabaseClient: any; // 🔧 CRÍTICO: Cliente que dispara Realtime
}

export class ManualDocumentProcessor {
  private static instance: ManualDocumentProcessor;

  private constructor() {}

  static getInstance(): ManualDocumentProcessor {
    if (!ManualDocumentProcessor.instance) {
      ManualDocumentProcessor.instance = new ManualDocumentProcessor();
    }
    return ManualDocumentProcessor.instance;
  }

  /**
   * 🚀 PROCESAR DOCUMENTO SUBIDO MANUALMENTE
   * 
   * Adapta el sistema optimizado para trabajar con archivos subidos manualmente
   */
  async processManualDocument(data: ManualDocumentData): Promise<{
    success: boolean;
    documentId?: string;
    orderId?: string;
    error?: string;
    ocrData?: any;
  }> {
    try {
      const { file, filename, mimeType, providerId, userId, requestId } = data;
      
      // Convertir File a Buffer si es necesario
      let fileBuffer: Buffer;
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        fileBuffer = file;
      }

      // Usar el sistema optimizado de Kapso adaptado
      // El cliente supabaseClient ya viene del parámetro (del servidor)
      const result = await kapsoDocumentProcessor.processDocument(
        null, // No hay fromNumber en subidas manuales
        {
          filename,
          mimeType,
          url: '', // No hay URL externa, el archivo ya está en memoria
          fileBuffer, // Pasar el buffer directamente
          providerId // Proveedor ya conocido
        },
        userId,
        requestId,
        data.supabaseClient // 🔧 CRÍTICO: Cliente que dispara Realtime
      );

      return result;

    } catch (error) {
      console.error(`❌ [${data.requestId}] Error procesando documento manual:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
}

export const manualDocumentProcessor = ManualDocumentProcessor.getInstance();

