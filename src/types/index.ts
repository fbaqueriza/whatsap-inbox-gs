// Use Firebase Auth User type directly in the app, no need to redefine here.

// Provider types
export interface Provider {
  id: string;
  user_id: string;
  name: string;
  email: string;
  contactName?: string;
  phone: string;
  address?: string;
  categories: string[];
  tags: string[];
  notes?: string;
  cbu?: string;
  alias?: string;
  cuitCuil?: string;
  razonSocial?: string;
  // Nuevos campos para configuración de entrega y pago
  defaultDeliveryDays?: string[]; // ['monday', 'wednesday', 'friday']
  defaultDeliveryTime?: string[]; // '15:00'
  defaultPaymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
  paymentTermDays?: number; // Plazo de pago en días (ej: 30, 45, 60)
  // Flujo automático de órdenes
  autoOrderFlowEnabled?: boolean; // Activar/desactivar flujo automático de órdenes
  catalogs: Catalog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Catalog {
  id: string;
  providerId: string;
  name: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  expiresAt?: Date;
}

// Stock types
export interface StockItem {
  id: string;
  user_id: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  restockFrequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  associatedProviders: string[]; // Provider IDs
  preferredProvider?: string; // Provider ID
  lastOrdered?: Date;
  nextOrder?: Date;
  createdAt: Date;
  updatedAt: Date;
  consumptionHistory?: number[];
}

// Order types
export interface Order {
  id: string;
  user_id: string;
  orderNumber: string;
  providerId: string;
  provider?: Provider; // 🔧 NUEVO: Información del proveedor incluida
  items: OrderItem[];
  status: 'standby' | 'enviado' | 'esperando_factura' | 'pendiente_de_pago' | 'pagado' | 'comprobante_enviado' | 'finalizado' | 'cancelled';
  totalAmount: number;
  currency: string;
  orderDate: Date;
  dueDate?: Date;
  // Nuevos campos para fecha de entrega y forma de pago
  desiredDeliveryDate?: Date;
  desiredDeliveryTime?: string[]; // ['14:00-16:00', '09:00-11:00']
  paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
  invoiceNumber?: string;
  invoiceDate?: Date;
  bankInfo?: {
    iban?: string;
    swift?: string;
    accountNumber?: string;
    bankName?: string;
  };
  receiptUrl?: string;
  invoiceFileUrl?: string;
  paymentReceiptUrl?: string;
  notes?: string;
  // Nuevo campo para archivos adicionales
  additionalFiles?: OrderFile[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

// Nuevo tipo para archivos adicionales de órdenes
export interface OrderFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Date;
  description?: string;
}

// Payment types
export interface Payment {
  id: string;
  orderId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: Date;
  invoiceNumber?: string;
  bankInfo?: {
    iban?: string;
    swift?: string;
    accountNumber?: string;
    bankName?: string;
  };
  confirmationUrl?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// WhatsApp message types
export interface WhatsAppMessage {
  id: string;
  orderId: string;
  providerId: string;
  type: 'order' | 'confirmation';
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

// PDF parsing types
export interface ParsedReceipt {
  totalAmount: number;
  currency: string;
  dueDate: Date;
  invoiceNumber: string;
  bankInfo: {
    iban?: string;
    swift?: string;
    accountNumber?: string;
    bankName?: string;
  };
  confidence: number;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export interface ProviderForm {
  name: string;
  email: string;
  phone: string;
  address?: string;
  categories: string[];
  tags: string[];
  notes?: string;
  cbu?: string;
  alias?: string;
  cuitCuil?: string;
  razonSocial?: string;
}

export interface StockItemForm {
  productName: string;
  quantity: number;
  unit: string;
  restockFrequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  minimumQuantity: number;
  currentStock: number;
  associatedProviders: string[];
  preferredProvider?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Table types
export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: number;
  render?: (value: any, row: T) => any;
}

export interface TableState {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters: Record<string, any>;
}

// Export types
export interface ExportOptions {
  format: 'xlsx' | 'csv';
  selectedIds?: string[];
  filters?: Record<string, any>;
}

// File upload types
export interface FileUpload {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
} 
