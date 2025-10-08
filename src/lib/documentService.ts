/**
 * SERVICIO DE GESTIÓN DE DOCUMENTOS
 * Maneja el almacenamiento, procesamiento OCR y asignación automática de documentos
 * Fecha: 17/09/2025
 */

import { createClient } from '@supabase/supabase-js';
import { 
  Document, 
  DocumentType, 
  SenderType, 
  DocumentStatus,
  OCRData,
  DocumentProcessingResult,
  DocumentFilters,
  DocumentStats,
  AssignmentMethod
} from '../types/documents';
import { PhoneNumberService } from './phoneNumberService';

export class DocumentService {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * 📄 CREAR DOCUMENTO EN LA BASE DE DATOS
   */
  async createDocument(documentData: {
    user_id: string;
    filename: string;
    file_url: string;
    file_size?: number;
    file_type: DocumentType;
    mime_type?: string;
    whatsapp_message_id?: string;
    sender_phone?: string;
    sender_type: SenderType;
    provider_id?: string;
    order_id?: string;
  }): Promise<{ success: boolean; document_id?: string; error?: string }> {
    try {
      console.log('📄 [DocumentService] Creando documento:', documentData.filename);
      
      // 🔧 CORRECCIÓN: Usar sender_phone directamente (la columna existe)
      const documentRecord = {
        ...documentData,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await this.supabase
        .from('documents')
        .insert([documentRecord])
        .select('id')
        .single();

      if (error) {
        console.error('❌ [DocumentService] Error creando documento:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [DocumentService] Documento creado:', data.id);
      return { success: true, document_id: data.id };

    } catch (error) {
      console.error('❌ [DocumentService] Error inesperado:', error);
      return { success: false, error: 'Error inesperado creando documento' };
    }
  }

  /**
   * 🔍 OBTENER DOCUMENTOS CON FILTROS
   */
  async getDocuments(userId: string, filters: DocumentFilters = {}): Promise<Document[]> {
    try {
      let query = this.supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters.provider_id) query = query.eq('provider_id', filters.provider_id);
      if (filters.order_id) query = query.eq('order_id', filters.order_id);
      if (filters.file_type) query = query.eq('file_type', filters.file_type);
      if (filters.sender_type) query = query.eq('sender_type', filters.sender_type);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.date_from) query = query.gte('created_at', filters.date_from);
      if (filters.date_to) query = query.lte('created_at', filters.date_to);
      if (filters.search_text) {
        query = query.or(`filename.ilike.%${filters.search_text}%,extracted_text.ilike.%${filters.search_text}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [DocumentService] Error obteniendo documentos:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('❌ [DocumentService] Error inesperado:', error);
      return [];
    }
  }

  /**
   * 🤖 PROCESAR DOCUMENTO CON OCR
   */
  async processDocumentWithOCR(documentId: string): Promise<DocumentProcessingResult> {
    try {
      console.log('🤖 [DocumentService] Procesando documento con OCR:', documentId);
      
      // Actualizar estado a processing
      await this.updateDocumentStatus(documentId, 'processing');

      // Obtener documento
      const document = await this.getDocumentById(documentId);
      if (!document) {
        return { success: false, document_id: documentId, error: 'Documento no encontrado' };
      }

      // Ejecutar OCR (usar el servicio existente)
      const ocrResult = await this.extractOCRData(document.file_url, document.file_type);
      
      if (!ocrResult.success) {
        await this.updateDocumentStatus(documentId, 'error', ocrResult.error);
        return { success: false, document_id: documentId, error: ocrResult.error };
      }

      // Actualizar documento con datos OCR
      const updateData = {
        ocr_data: ocrResult.ocr_data,
        confidence_score: ocrResult.confidence_score,
        extracted_text: ocrResult.extracted_text,
        status: 'processed' as DocumentStatus,
        processed_at: new Date().toISOString()
      };

      const { error: updateError } = await this.supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) {
        console.error('❌ [DocumentService] Error actualizando documento:', updateError);
        return { success: false, document_id: documentId, error: 'Error actualizando documento' };
      }

      // Intentar asignación automática
      const assignmentResult = await this.attemptAutomaticAssignment(documentId, ocrResult.ocr_data);

      console.log('✅ [DocumentService] Documento procesado exitosamente');
      return {
        success: true,
        document_id: documentId,
        ocr_data: ocrResult.ocr_data,
        assigned_to_order: assignmentResult.order_id,
        assigned_to_provider: assignmentResult.provider_id,
        confidence_score: ocrResult.confidence_score
      };

    } catch (error) {
      console.error('❌ [DocumentService] Error procesando documento:', error);
      await this.updateDocumentStatus(documentId, 'error', error instanceof Error ? error.message : 'Error inesperado');
      return { success: false, document_id: documentId, error: 'Error procesando documento' };
    }
  }

  /**
   * 🔗 INTENTAR ASIGNACIÓN AUTOMÁTICA
   */
  async attemptAutomaticAssignment(documentId: string, ocrData: OCRData): Promise<{
    order_id?: string;
    provider_id?: string;
    method?: AssignmentMethod;
    confidence?: number;
  }> {
    try {
      console.log('🔗 [DocumentService] Intentando asignación automática para documento:', documentId);
      
      const document = await this.getDocumentById(documentId);
      if (!document || !ocrData) {
        return {};
      }

      // 1. Intentar asignar por CUIT del proveedor
      if (ocrData.provider_cuit) {
        const providerMatch = await this.findProviderByCuit(document.user_id, ocrData.provider_cuit);
        if (providerMatch) {
          await this.assignDocumentToProvider(documentId, providerMatch.id, 'cuit_match', 0.9);
          
          // 2. Intentar asignar a orden por fecha
          const orderMatch = await this.findOrderByDateAndProvider(
            document.user_id, 
            providerMatch.id, 
            ocrData.invoice_data?.issue_date
          );
          
          if (orderMatch) {
            await this.assignDocumentToOrder(documentId, orderMatch.id, 'date_match', 0.8);
            return { order_id: orderMatch.id, provider_id: providerMatch.id, method: 'date_match', confidence: 0.8 };
          }
          
          return { provider_id: providerMatch.id, method: 'cuit_match', confidence: 0.9 };
        }
      }

      // 3. Intentar asignar por teléfono del remitente
      if (document.sender_phone) {
        const providerMatch = await this.findProviderByPhone(document.user_id, document.sender_phone);
        if (providerMatch) {
          await this.assignDocumentToProvider(documentId, providerMatch.id, 'phone_match', 0.7);
          return { provider_id: providerMatch.id, method: 'phone_match', confidence: 0.7 };
        }
      }

      console.log('ℹ️ [DocumentService] No se pudo asignar automáticamente');
      return {};

    } catch (error) {
      console.error('❌ [DocumentService] Error en asignación automática:', error);
      return {};
    }
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DE DOCUMENTOS
   */
  async getDocumentStats(userId: string): Promise<DocumentStats> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('file_type, status, sender_type, created_at')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [DocumentService] Error obteniendo estadísticas:', error);
        return this.getEmptyStats();
      }

      const stats: DocumentStats = {
        total_documents: data.length,
        by_type: { catalogo: 0, factura: 0, comprobante: 0, foto: 0, other: 0 },
        by_status: { pending: 0, processing: 0, processed: 0, assigned: 0, error: 0 },
        by_sender: { provider: 0, user: 0 },
        recent_uploads: 0,
        pending_processing: 0
      };

      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      data.forEach(doc => {
        // Por tipo
        stats.by_type[doc.file_type]++;
        
        // Por estado
        stats.by_status[doc.status]++;
        
        // Por remitente
        stats.by_sender[doc.sender_type]++;
        
        // Recientes
        if (new Date(doc.created_at) > last24Hours) {
          stats.recent_uploads++;
        }
        
        // Pendientes de procesamiento
        if (doc.status === 'pending' || doc.status === 'processing') {
          stats.pending_processing++;
        }
      });

      return stats;

    } catch (error) {
      console.error('❌ [DocumentService] Error obteniendo estadísticas:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * 🔍 OBTENER DOCUMENTO POR ID
   */
  async getDocumentById(documentId: string): Promise<Document | null> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * 📝 ACTUALIZAR DOCUMENTO CON DATOS DE OCR
   */
  async updateDocumentWithOCRData(documentId: string, ocrData: {
    extracted_text?: string;
    extracted_data?: any;
    confidence_score?: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📝 [DocumentService] Actualizando documento con datos OCR:', documentId);
      
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (ocrData.extracted_text) updateData.extracted_text = ocrData.extracted_text;
      if (ocrData.extracted_data) updateData.ocr_data = ocrData.extracted_data;
      if (ocrData.confidence_score !== undefined) updateData.confidence_score = ocrData.confidence_score;

      // Marcar como procesado si tiene datos
      if (ocrData.extracted_text || ocrData.extracted_data) {
        updateData.status = 'processed';
        updateData.processed_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) {
        console.error('❌ [DocumentService] Error actualizando documento:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [DocumentService] Documento actualizado exitosamente');
      return { success: true };

    } catch (error) {
      console.error('❌ [DocumentService] Error inesperado actualizando documento:', error);
      return { success: false, error: 'Error inesperado actualizando documento' };
    }
  }

  private async updateDocumentStatus(documentId: string, status: DocumentStatus, error?: string) {
    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    
    if (error) updateData.processing_error = error;

    await this.supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);
  }

  private async extractOCRData(fileUrl: string, fileType: DocumentType): Promise<{
    success: boolean;
    ocr_data?: OCRData;
    confidence_score?: number;
    extracted_text?: string;
    error?: string;
  }> {
    try {
      // Usar el servicio de OCR existente
      const { ocrService } = await import('./ocrService.js');
      
      // Descargar y procesar archivo
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      
      const result = await ocrService.extractTextFromPDF(Buffer.from(buffer), 'documento.pdf');
      
      return {
        success: true,
        ocr_data: result,
        confidence_score: result.confidence || 0.5,
        extracted_text: result.text || ''
      };

    } catch (error) {
      console.error('❌ [DocumentService] Error en OCR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error en OCR'
      };
    }
  }

  private async findProviderByCuit(userId: string, cuit: string) {
    const { data } = await this.supabase
      .from('providers')
      .select('id, name, cuit_cuil')
      .eq('user_id', userId)
      .ilike('cuit_cuil', `%${cuit}%`)
      .limit(1)
      .single();

    return data;
  }

  private async findProviderByPhone(userId: string, phone: string) {
    const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phone);
    if (!normalizedPhone) return null;

    const { data } = await this.supabase
      .from('providers')
      .select('id, name, phone')
      .eq('user_id', userId)
      .eq('phone', normalizedPhone)
      .limit(1)
      .single();

    return data;
  }

  private async findOrderByDateAndProvider(userId: string, providerId: string, date?: string) {
    if (!date) return null;

    const { data } = await this.supabase
      .from('orders')
      .select('id, order_number, created_at')
      .eq('user_id', userId)
      .eq('provider_id', providerId)
      .gte('created_at', new Date(date).toISOString())
      .lte('created_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 días después
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  private async assignDocumentToProvider(documentId: string, providerId: string, method: AssignmentMethod, confidence: number) {
    await this.supabase
      .from('documents')
      .update({ 
        provider_id: providerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // Registrar intento de asignación
    await this.supabase
      .from('document_assignment_attempts')
      .insert([{
        document_id: documentId,
        assignment_method: method,
        confidence_score: confidence,
        match_details: { provider_id: providerId },
        success: true,
        created_at: new Date().toISOString()
      }]);
  }

  private async assignDocumentToOrder(documentId: string, orderId: string, method: AssignmentMethod, confidence: number) {
    await this.supabase
      .from('documents')
      .update({ 
        order_id: orderId,
        status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // Registrar intento de asignación
    await this.supabase
      .from('document_assignment_attempts')
      .insert([{
        document_id: documentId,
        order_id: orderId,
        assignment_method: method,
        confidence_score: confidence,
        match_details: { order_id: orderId },
        success: true,
        created_at: new Date().toISOString()
      }]);
  }

  private getEmptyStats(): DocumentStats {
    return {
      total_documents: 0,
      by_type: { catalogo: 0, factura: 0, comprobante: 0, foto: 0, other: 0 },
      by_status: { pending: 0, processing: 0, processed: 0, assigned: 0, error: 0 },
      by_sender: { provider: 0, user: 0 },
      recent_uploads: 0,
      pending_processing: 0
    };
  }
}
