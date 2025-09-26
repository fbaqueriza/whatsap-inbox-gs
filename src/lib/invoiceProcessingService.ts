/**
 * 🔧 REFACTORIZACIÓN: Servicio centralizado para procesamiento de facturas
 * Maneja OCR, extracción de datos y actualización de órdenes
 */

import { getSupabaseServerClient } from './supabase/serverClient';
import { ORDER_STATUS } from './orderConstants';

export interface InvoiceData {
  invoiceNumber: string;
  totalAmount: number;
  invoiceDate: string;
  cuit: string;
  providerName?: string;
  confidence: number;
}

export interface ProcessingResult {
  success: boolean;
  data?: InvoiceData;
  error?: string;
  orderId?: string;
}

export class InvoiceProcessingService {
  private static instance: InvoiceProcessingService;
  private supabase = getSupabaseServerClient();

  static getInstance(): InvoiceProcessingService {
    if (!InvoiceProcessingService.instance) {
      InvoiceProcessingService.instance = new InvoiceProcessingService();
    }
    return InvoiceProcessingService.instance;
  }

  /**
   * 🔧 Procesar factura desde URL con OCR real
   */
  async processInvoiceFromUrl(
    fileUrl: string, 
    orderId: string, 
    providerId: string
  ): Promise<ProcessingResult> {
    try {
      console.log('🔍 Iniciando procesamiento de factura:', { fileUrl, orderId, providerId });

      // 1. Descargar archivo
      const fileBuffer = await this.downloadFile(fileUrl);
      if (!fileBuffer) {
        return { success: false, error: 'No se pudo descargar el archivo' };
      }

      // 2. Procesar OCR
      const ocrData = await this.performOCR(fileBuffer);
      if (!ocrData.success) {
        return { success: false, error: ocrData.error };
      }

      // 3. Extraer datos estructurados
      const invoiceData = this.extractInvoiceData(ocrData.text);
      
      // 4. Actualizar orden
      const updateResult = await this.updateOrderWithInvoiceData(
        orderId, 
        invoiceData, 
        fileUrl
      );

      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      console.log('✅ Factura procesada exitosamente:', invoiceData);
      
      return {
        success: true,
        data: invoiceData,
        orderId
      };

    } catch (error) {
      console.error('❌ Error procesando factura:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * 🔧 Descargar archivo desde URL
   */
  private async downloadFile(url: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('❌ Error descargando archivo:', error);
      return null;
    }
  }

  /**
   * 🔧 Realizar OCR usando Tesseract.js
   */
  private async performOCR(fileBuffer: Buffer): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      // Importar Tesseract dinámicamente
      const { createWorker } = await import('tesseract.js');
      
      const worker = await createWorker('spa'); // Español
      const { data: { text } } = await worker.recognize(fileBuffer);
      await worker.terminate();

      console.log('📄 Texto extraído por OCR:', text.substring(0, 200) + '...');
      
      return { success: true, text };
    } catch (error) {
      console.error('❌ Error en OCR:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error en OCR' 
      };
    }
  }

  /**
   * 🔧 Extraer datos estructurados del texto OCR
   */
  private extractInvoiceData(text: string): InvoiceData {
    const data: InvoiceData = {
      invoiceNumber: '',
      totalAmount: 0,
      invoiceDate: new Date().toISOString(),
      cuit: '',
      confidence: 0.8
    };

    // Extraer número de factura
    const invoiceNumberMatch = text.match(/(?:factura|invoice|n[º°]?)\s*:?\s*([A-Z0-9\-]+)/i);
    if (invoiceNumberMatch) {
      data.invoiceNumber = invoiceNumberMatch[1];
    } else {
      data.invoiceNumber = `FAC-${Date.now()}`;
    }

    // Extraer monto total
    const amountMatches = text.match(/(?:total|importe|monto)\s*:?\s*\$?\s*([0-9,\.]+)/i);
    if (amountMatches) {
      const amountStr = amountMatches[1].replace(/[,\s]/g, '');
      data.totalAmount = parseFloat(amountStr) || 0;
    }

    // Extraer fecha
    const dateMatches = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatches) {
      try {
        const dateStr = dateMatches[1];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          data.invoiceDate = date.toISOString();
        }
      } catch (error) {
        console.warn('⚠️ Error parseando fecha:', error);
      }
    }

    // Extraer CUIT
    const cuitMatches = text.match(/(\d{2}[\-\.]?\d{8}[\-\.]?\d{1})/);
    if (cuitMatches) {
      data.cuit = cuitMatches[1];
    }

    console.log('📊 Datos extraídos:', data);
    return data;
  }

  /**
   * 🔧 Actualizar orden con datos de factura
   */
  private async updateOrderWithInvoiceData(
    orderId: string, 
    invoiceData: InvoiceData, 
    fileUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabase) {
        return { success: false, error: 'No se pudo conectar a Supabase' };
      }

      const { error } = await this.supabase
        .from('orders')
        .update({
          invoice_number: invoiceData.invoiceNumber,
          total_amount: invoiceData.totalAmount,
          receipt_url: fileUrl,
          status: ORDER_STATUS.PENDIENTE_DE_PAGO,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('❌ Error actualizando orden:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Orden actualizada con datos de factura');
      return { success: true };

    } catch (error) {
      console.error('❌ Error actualizando orden:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error actualizando orden' 
      };
    }
  }

  /**
   * 🔧 Procesar factura desde WhatsApp (compatible con webhook)
   */
  async processWhatsAppInvoice(
    mediaUrl: string,
    providerPhone: string,
    requestId: string
  ): Promise<ProcessingResult> {
    try {
      console.log(`📱 [${requestId}] Procesando factura de WhatsApp:`, { mediaUrl, providerPhone });

      // 1. Buscar orden pendiente del proveedor
      const order = await this.findPendingOrderByProvider(providerPhone);
      if (!order) {
        return { 
          success: false, 
          error: 'No se encontró orden pendiente para este proveedor' 
        };
      }

      // 2. Descargar archivo desde WhatsApp
      const fileBuffer = await this.downloadWhatsAppMedia(mediaUrl, requestId);
      if (!fileBuffer) {
        return { success: false, error: 'No se pudo descargar archivo de WhatsApp' };
      }

      // 3. Subir a Supabase Storage
      const uploadResult = await this.uploadToStorage(fileBuffer, order.id, requestId);
      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }

      // 4. Procesar con OCR
      const ocrData = await this.performOCR(fileBuffer);
      if (!ocrData.success) {
        return { success: false, error: ocrData.error };
      }

      // 5. Extraer datos y actualizar orden
      const invoiceData = this.extractInvoiceData(ocrData.text);
      const updateResult = await this.updateOrderWithInvoiceData(
        order.id, 
        invoiceData, 
        uploadResult.fileUrl
      );

      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      console.log(`✅ [${requestId}] Factura de WhatsApp procesada exitosamente`);
      
      return {
        success: true,
        data: invoiceData,
        orderId: order.id
      };

    } catch (error) {
      console.error(`❌ [${requestId}] Error procesando factura de WhatsApp:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error procesando factura' 
      };
    }
  }

  /**
   * 🔧 Buscar orden pendiente por teléfono de proveedor
   */
  private async findPendingOrderByProvider(providerPhone: string): Promise<any | null> {
    try {
      if (!this.supabase) return null;

      // Buscar proveedor por teléfono
      const { data: provider } = await this.supabase
        .from('providers')
        .select('id')
        .eq('phone', providerPhone)
        .single();

      if (!provider) return null;

      // Buscar orden pendiente del proveedor
      const { data: order } = await this.supabase
        .from('orders')
        .select('*')
        .eq('provider_id', provider.id)
        .eq('status', ORDER_STATUS.ENVIADO)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return order;
    } catch (error) {
      console.error('❌ Error buscando orden pendiente:', error);
      return null;
    }
  }

  /**
   * 🔧 Descargar archivo multimedia de WhatsApp
   */
  private async downloadWhatsAppMedia(mediaUrl: string, requestId: string): Promise<Buffer | null> {
    try {
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        console.warn(`⚠️ [${requestId}] WhatsApp devolvió JSON en lugar de archivo`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error(`❌ [${requestId}] Error descargando archivo de WhatsApp:`, error);
      return null;
    }
  }

  /**
   * 🔧 Subir archivo usando servicio estandarizado de storage
   */
  private async uploadToStorage(
    fileBuffer: Buffer, 
    orderId: string, 
    requestId: string
  ): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
    try {
      const { StorageService } = await import('./storageService');
      const storageService = StorageService.getInstance();

      const result = await storageService.uploadInvoice(fileBuffer, orderId, 'unknown');

      if (!result.success) {
        console.error(`❌ [${requestId}] Error subiendo archivo:`, result.error);
        return { success: false, error: result.error };
      }

      console.log(`✅ [${requestId}] Archivo subido exitosamente:`, result.fileUrl);
      
      return { success: true, fileUrl: result.fileUrl };

    } catch (error) {
      console.error(`❌ [${requestId}] Error subiendo archivo:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error subiendo archivo' 
      };
    }
  }
}
