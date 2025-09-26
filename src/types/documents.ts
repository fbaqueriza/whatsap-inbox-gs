/**
 * TIPOS PARA EL SISTEMA DE GESTIÓN DE DOCUMENTOS
 * Fecha: 17/09/2025
 */

export type DocumentType = 'catalogo' | 'factura' | 'comprobante' | 'foto' | 'other';
export type SenderType = 'provider' | 'user';
export type DocumentStatus = 'pending' | 'processing' | 'processed' | 'assigned' | 'error';
export type AssignmentMethod = 'cuit_match' | 'date_match' | 'phone_match' | 'manual';
export type NotificationType = 'document_received' | 'document_processed' | 'document_assigned' | 'processing_error';

export interface Document {
  id: string;
  user_id: string;
  provider_id?: string;
  order_id?: string;
  
  // Información del archivo
  filename: string;
  file_url: string;
  file_size?: number;
  file_type: DocumentType;
  mime_type?: string;
  
  // Datos de WhatsApp
  whatsapp_message_id?: string;
  sender_phone?: string;
  sender_type: SenderType;
  
  // Datos de OCR
  ocr_data?: OCRData;
  confidence_score?: number;
  extracted_text?: string;
  
  // Estado y metadatos
  status: DocumentStatus;
  processing_error?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  processed_at?: string;
}

export interface OCRData {
  // Datos básicos extraídos
  document_type?: DocumentType;
  provider_name?: string;
  provider_cuit?: string;
  
  // Datos específicos por tipo de documento
  invoice_data?: InvoiceData;
  catalog_data?: CatalogData;
  receipt_data?: ReceiptData;
  
  // Metadatos del OCR
  processing_time?: number;
  ocr_engine?: string;
  language_detected?: string;
}

export interface InvoiceData {
  invoice_number?: string;
  total_amount?: number;
  currency?: string;
  issue_date?: string;
  due_date?: string;
  tax_amount?: number;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CatalogData {
  catalog_name?: string;
  valid_from?: string;
  valid_to?: string;
  categories?: string[];
  total_products?: number;
}

export interface ReceiptData {
  receipt_number?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  transaction_date?: string;
  reference?: string;
}

export interface DocumentAssignmentAttempt {
  id: string;
  document_id: string;
  order_id: string;
  assignment_method: AssignmentMethod;
  confidence_score?: number;
  match_details?: any;
  success: boolean;
  created_at: string;
}

export interface DocumentNotification {
  id: string;
  document_id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface DocumentFilters {
  provider_id?: string;
  order_id?: string;
  file_type?: DocumentType;
  sender_type?: SenderType;
  status?: DocumentStatus;
  date_from?: string;
  date_to?: string;
  search_text?: string;
}

export interface DocumentProcessingResult {
  success: boolean;
  document_id: string;
  ocr_data?: OCRData;
  assigned_to_order?: string;
  assigned_to_provider?: string;
  confidence_score?: number;
  error?: string;
}

export interface DocumentUploadRequest {
  file: File;
  sender_type: SenderType;
  provider_id?: string;
  order_id?: string;
  description?: string;
}

export interface DocumentStats {
  total_documents: number;
  by_type: Record<DocumentType, number>;
  by_status: Record<DocumentStatus, number>;
  by_sender: Record<SenderType, number>;
  recent_uploads: number;
  pending_processing: number;
}
