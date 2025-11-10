// WhatsApp Integration Types
import { OrderItem } from './index';

export interface WhatsAppMessage {
  id: string;
  type: 'sent' | 'received';
  content: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  // Campos adicionales para compatibilidad
  from?: string;
  to?: string;
  orderId?: string;
  providerId?: string;
  // Campos para templates
  isTemplate?: boolean;
  templateName?: string;
  // Campos para documentos
  isDocument?: boolean;
  mediaUrl?: string;
  filename?: string;
  mediaType?: string;
}

export interface ChatWhatsAppMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'sent' | 'received';
  contact_id: string;
  contact_name?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  // Campos adicionales para compatibilidad con Realtime
  message_sid?: string;
  message_type?: 'sent' | 'received';
  user_id?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
  // Campos adicionales para proveedores
  providerId?: string;
  email?: string;
  address?: string;
  category?: string;
  // Campo para identificar contactos de Kapso
  isKapsoContact?: boolean;
} 