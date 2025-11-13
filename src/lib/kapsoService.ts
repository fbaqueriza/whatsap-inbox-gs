/**
 * Servicio para usar Kapso como almacén principal de mensajes
 * Supabase solo para datos de negocio (órdenes, documentos, proveedores)
 */

import { logger } from './logger';
import { normalizePhoneNumber, comparePhoneNumbers } from './phoneNormalization';
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

export interface KapsoConversation {
  id: string;
  phone_number: string;
  status: 'active' | 'ended';
  last_active_at: string;
  contact_name?: string;
  whatsapp_config_id: string;
}

export interface KapsoMessage {
  id: string;
  conversation_id: string;
  content: string;
  timestamp: string;
  type: 'text' | 'document' | 'image' | 'audio' | 'video';
  direction: 'inbound' | 'outbound';
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  media_url?: string;
  filename?: string;
  mime_type?: string;
}

export interface KapsoContact {
  id: string;
  phone_number: string;
  name?: string;
  whatsapp_config_id: string;
  created_at: string;
  updated_at: string;
}

export interface KapsoWhatsAppConfig {
  id: string;
  business_account_id?: string;
  calls_enabled: boolean;
  created_at: string;
  customer_id?: string;
  display_name: string;
  display_phone_number?: string;
  display_phone_number_normalized?: string;
  inbound_processing_enabled: boolean;
  is_coexistence: boolean;
  kind: 'production' | 'sandbox';
  name: string;
  phone_number_id?: string;
  updated_at: string;
  webhook_verified_at?: string;
}

export interface KapsoApiResponse<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

export class KapsoService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    // Solo usar en el servidor
    if (typeof window !== 'undefined') {
      logger.error('KapsoService', 'Solo puede usarse en el servidor');
      throw new Error('KapsoService solo puede usarse en el servidor');
    }
    
    // ✅ CORRECCIÓN: Validar y corregir URL de Kapso
    const envUrl = process.env.KAPSO_API_URL?.trim();
    const defaultUrl = 'https://app.kapso.ai/api/v1';
    
    // Si la URL está mal configurada o incompleta, usar la por defecto
    if (envUrl && envUrl.includes('app.kapso.ai')) {
      this.baseUrl = envUrl.endsWith('/api/v1') ? envUrl : `${envUrl.replace(/\/$/, '')}/api/v1`;
    } else if (envUrl && !envUrl.includes('app.kap')) {
      // Si tiene una URL válida pero no es de Kapso, usarla
      this.baseUrl = envUrl;
    } else {
      // Si está mal configurada (como 'app.kap'), usar la por defecto
      console.warn('⚠️ [KapsoService] KAPSO_API_URL mal configurada, usando URL por defecto');
      this.baseUrl = defaultUrl;
    }
    
    this.apiKey = (process.env.KAPSO_API_KEY || '').trim();
    
    if (!this.apiKey) {
      logger.error('KapsoService', 'KAPSO_API_KEY no está configurada');
      throw new Error('KAPSO_API_KEY no está configurada en las variables de entorno');
    }
    
    logger.debug('KapsoService', 'Servicio inicializado correctamente', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey
    });
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    logger.debug('KapsoService', `API call: ${options.method || 'GET'} ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      logger.apiCall('KapsoService', options.method || 'GET', endpoint, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        logger.apiError('KapsoService', options.method || 'GET', endpoint, errorText);
        throw new Error(`Kapso API Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      logger.debug('KapsoService', `Response received for ${endpoint}`, { 
        dataCount: result.data?.length || 0,
        totalCount: result.meta?.total_count || 0
      });
      
      return result;
    } catch (error) {
      logger.apiError('KapsoService', options.method || 'GET', endpoint, error);
      throw error;
    }
  }

  /**
   * Obtener todas las conversaciones de WhatsApp
   */
  async getConversations(params?: {
    page?: number;
    per_page?: number;
    status?: 'active' | 'ended';
    phone_number?: string;
  }): Promise<KapsoApiResponse<KapsoConversation>> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params?.status) searchParams.append('q[status_eq]', params.status);
    if (params?.phone_number) searchParams.append('q[phone_number_eq]', params.phone_number);
    
    const endpoint = `/whatsapp_conversations?${searchParams.toString()}`;
    return this.makeRequest<KapsoApiResponse<KapsoConversation>>(endpoint);
  }

  /**
   * Obtener todas las conversaciones (alias para getConversations)
   */
  async getAllConversations(params?: {
    page?: number;
    per_page?: number;
    status?: 'active' | 'ended';
    phone_number?: string;
  }): Promise<KapsoApiResponse<KapsoConversation>> {
    return this.getConversations(params);
  }

  /**
   * Obtener conversaciones por configuración de WhatsApp
   */
  async getConversationsByConfig(configId: string, params?: {
    page?: number;
    per_page?: number;
    status?: 'active' | 'ended';
  }): Promise<KapsoConversation[]> {
    const response = await this.getConversations(params);
    return response.data.filter(conv => conv.whatsapp_config_id === configId);
  }

  /**
   * Obtener mensajes de una conversación específica
   */
  async getMessages(conversationId: string, params?: {
    page?: number;
    per_page?: number;
  }): Promise<KapsoApiResponse<KapsoMessage>> {
    const searchParams = new URLSearchParams();
    
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    
    const endpoint = `/whatsapp_conversations/${conversationId}/whatsapp_messages?${searchParams.toString()}`;
    return this.makeRequest<KapsoApiResponse<KapsoMessage>>(endpoint);
  }

  /**
   * Obtener mensajes por número de teléfono
   */
  async getMessagesForPhone(phoneNumber: string): Promise<{
    messages: KapsoMessage[];
    hasMore: boolean;
  }> {
    try {
      // Normalizar el número de teléfono de entrada
      const normalizedInput = normalizePhoneNumber(phoneNumber);
      logger.debug('KapsoService', `Buscando mensajes para número: ${phoneNumber} (normalizado: ${normalizedInput.normalized})`);

      // Primero obtener todas las conversaciones
      const conversationsResponse = await this.getConversations({
        status: 'active',
        page: 1
      });

      logger.debug('KapsoService', `Conversaciones disponibles:`, conversationsResponse.data.map(conv => ({
        id: conv.id,
        phone: conv.phone_number,
        normalized: normalizePhoneNumber(conv.phone_number).normalized
      })));

      // Buscar la conversación que coincida con el número de teléfono usando normalización
      const matchingConversation = conversationsResponse.data.find(conv => {
        const normalizedConv = normalizePhoneNumber(conv.phone_number);
        const isMatch = comparePhoneNumbers(phoneNumber, conv.phone_number);
        
        logger.debug('KapsoService', `Comparando ${phoneNumber} con ${conv.phone_number}: ${isMatch}`);
        return isMatch;
      });

      if (!matchingConversation) {
        logger.warn('KapsoService', `No se encontró conversación para el número: ${phoneNumber} (normalizado: ${normalizedInput.normalized})`);
        logger.warn('KapsoService', `Conversaciones disponibles:`, conversationsResponse.data.map(conv => conv.phone_number));
        return { messages: [], hasMore: false };
      }

      logger.debug('KapsoService', `Conversación encontrada: ${matchingConversation.id} para ${matchingConversation.phone_number}`);

      // Obtener mensajes de la conversación encontrada
      const messagesResponse = await this.getMessages(matchingConversation.id, {
        page: 1,
        per_page: 50
      });

      logger.debug('KapsoService', `Mensajes obtenidos para ${phoneNumber}:`, messagesResponse.data?.length || 0);

      return {
        messages: messagesResponse.data || [],
        hasMore: messagesResponse.meta?.page < messagesResponse.meta?.total_pages
      };

    } catch (error: any) {
      logger.error('KapsoService', `Error obteniendo mensajes para ${phoneNumber}:`, error.message);
      return { messages: [], hasMore: false };
    }
  }

  /**
   * Obtener todas las conversaciones activas (método de conveniencia)
   */
  async getAllActiveConversations(): Promise<KapsoConversation[]> {
    const response = await this.getConversations({ status: 'active', per_page: 100 });
    logger.dataProcessed('KapsoService', 'conversaciones activas', response.data.length);
    return response.data;
  }

  /**
   * Obtener configuraciones de WhatsApp
   */
  async getWhatsAppConfigs(): Promise<KapsoApiResponse<KapsoWhatsAppConfig>> {
    return this.makeRequest<KapsoApiResponse<KapsoWhatsAppConfig>>('/whatsapp_configs');
  }

  /**
   * Obtener número de sandbox
   */
  async getSandboxNumber(): Promise<{ config_id: string; phone_number: string } | null> {
    try {
      const response = await this.getWhatsAppConfigs();
      const sandboxConfig = response.data.find(config => config.kind === 'sandbox');
      
      if (sandboxConfig) {
        logger.info('KapsoService', 'Sandbox encontrado', { 
          configId: sandboxConfig.id,
          phone: sandboxConfig.display_phone_number_normalized 
        });
        return {
          config_id: sandboxConfig.id,
          phone_number: sandboxConfig.display_phone_number_normalized || '+56920403095'
        };
      }
      
      logger.warn('KapsoService', 'No se encontró configuración de sandbox');
      return null;
    } catch (error) {
      logger.error('KapsoService', 'Error obteniendo sandbox', error);
      return null;
    }
  }

  /**
   * Enviar mensaje a través de Kapso (a una conversación específica)
   */
  async sendMessage(conversationId: string, message: { type: string; content: string }, userId?: string): Promise<any> {
    try {
      logger.info('KapsoService', 'Enviando mensaje a conversación', { 
        conversationId,
        messageType: message.type,
        userId
      });

      // Obtener información de la conversación para enviar el mensaje
      const conversations = await this.getAllActiveConversations();
      const conversation = conversations.find(conv => conv.id === conversationId);
      
      if (!conversation) {
        throw new Error('Conversación no encontrada');
      }

      // Obtener phone_number_id del usuario
      const phoneNumberId = await this.getPhoneNumberId(userId);
      
      // Usar WhatsAppClient de Kapso SDK
      const whatsappClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: this.apiKey,
        graphVersion: 'v24.0'
      });
      
      const result = await whatsappClient.messages.sendText({
        phoneNumberId,
        to: conversation.phone_number,
        body: message.content
      });

      logger.info('KapsoService', 'Mensaje enviado exitosamente', { 
        messageId: result.messages?.[0]?.id
      });

      return { data: { id: result.messages?.[0]?.id } };
    } catch (error) {
      logger.error('KapsoService', 'Error enviando mensaje', error);
      throw error;
    }
  }

  /**
   * Enviar mensaje standalone (sin conversación existente) a través de Kapso
   */
  async sendStandaloneMessage(phoneNumber: string, message: { type: string; content: string }, userId?: string): Promise<any> {
    try {
      logger.info('KapsoService', 'Enviando mensaje standalone', { 
        phone: phoneNumber,
        messageType: message.type,
        userId
      });

      // Obtener phone_number_id del usuario
      const phoneNumberId = await this.getPhoneNumberId(userId);
      
      // Usar WhatsAppClient de Kapso SDK
      const whatsappClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: this.apiKey,
        graphVersion: 'v24.0'
      });
      
      const result = await whatsappClient.messages.sendText({
        phoneNumberId,
        to: phoneNumber,
        body: message.content
      });

      logger.info('KapsoService', 'Mensaje standalone enviado exitosamente', { 
        messageId: result.messages?.[0]?.id
      });

      return { data: { id: result.messages?.[0]?.id } };
    } catch (error) {
      logger.error('KapsoService', 'Error enviando mensaje standalone', error);
      throw error;
    }
  }

  /**
   * Enviar documento standalone (sin conversación existente) a través de Kapso
   */
  async sendStandaloneDocument(
    phoneNumber: string, 
    documentUrl: string, 
    filename: string, 
    caption?: string,
    userId?: string
  ): Promise<any> {
    try {
      logger.info('KapsoService', 'Enviando documento standalone', { 
        phone: phoneNumber,
        filename,
        userId
      });

      // Obtener phone_number_id del usuario
      const phoneNumberId = await this.getPhoneNumberId(userId);
      
      // Usar WhatsAppClient de Kapso SDK
      const whatsappClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: this.apiKey,
        graphVersion: 'v24.0'
      });
      
      const result = await whatsappClient.messages.sendDocument({
        phoneNumberId,
        to: phoneNumber,
        document: {
          link: documentUrl,
          filename: filename,
          ...(caption && { caption })
        }
      });

      logger.info('KapsoService', 'Documento standalone enviado exitosamente', { 
        messageId: result.messages?.[0]?.id
      });

      return { data: { id: result.messages?.[0]?.id } };
    } catch (error) {
      logger.error('KapsoService', 'Error enviando documento standalone', error);
      throw error;
    }
  }

  /**
   * Obtener phone_number_id del usuario desde user_whatsapp_config
   */
  private async getPhoneNumberId(userId?: string): Promise<string> {
    // Si no hay userId, usar el valor por defecto
    if (!userId) {
      return process.env.WHATSAPP_PHONE_NUMBER_ID || '842420582288633';
    }

    try {
      // Intentar obtener desde la configuración del usuario
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: config } = await supabase
        .from('user_whatsapp_config')
        .select('phone_number_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      
      if (config?.phone_number_id) {
        logger.info('KapsoService', 'Usando phone_number_id del usuario', { phoneNumberId: config.phone_number_id });
        return config.phone_number_id;
      }
    } catch (error) {
      logger.warn('KapsoService', 'No se pudo obtener phone_number_id del usuario, usando valor por defecto', error);
    }
    
    // Fallback al valor por defecto
    return process.env.WHATSAPP_PHONE_NUMBER_ID || '842420582288633';
  }
}
