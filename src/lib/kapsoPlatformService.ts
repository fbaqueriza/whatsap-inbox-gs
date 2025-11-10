export interface CustomerData {
  name: string;
  external_customer_id: string;
  metadata?: Record<string, any>;
}

export interface SetupLinkData {
  customer_id: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  allowed_connection_types?: string[];
  theme_config?: {
    primary_color?: string;
  };
  expires_in?: number; // en segundos, por defecto 24 horas
  metadata?: Record<string, any>;
}

export interface MessageData {
  phone_number: string;
  content: string;
  message_type?: 'text' | 'template' | 'interactive';
  template?: {
    name: string;
    language: string;
    parameters?: any[];
  };
}

export interface WebhookData {
  url: string;
  events: string[];
  secret?: string;
}

export interface BroadcastData {
  name: string;
  message: MessageData;
  recipients: string[];
  scheduled_at?: string;
}

export class KapsoPlatformService {
  private readonly baseUrl = 'https://app.kapso.ai/api/v1';
  private readonly apiKey: string;

  constructor() {
    // Solo usar en el servidor
    if (typeof window !== 'undefined') {
      throw new Error('KapsoPlatformService solo puede usarse en el servidor');
    }
    
    this.apiKey = (process.env.KAPSO_API_KEY || '').trim();
    if (!this.apiKey) {
      throw new Error('KAPSO_API_KEY no está configurada en las variables de entorno');
    }
    
    console.log('✅ [KapsoPlatform] Servicio inicializado correctamente');
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`📤 [KapsoPlatform] ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [KapsoPlatform] Error ${response.status}: ${errorText}`);
      throw new Error(`Kapso Platform API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ [KapsoPlatform] Response received`);
    return data;
  }

  /**
   * Crear un nuevo cliente en Kapso Platform
   */
  async createCustomer(customerData: CustomerData) {
    try {
      console.log('👤 [KapsoPlatform] Creando cliente:', customerData.name);

      // Según documentación: el body debe tener estructura { customer: { ... } }
      const response = await this.makeRequest<{
        data: {
          id: string;
          name: string;
          external_customer_id: string;
          created_at: string;
          updated_at: string;
        };
      }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            name: customerData.name,
            external_customer_id: customerData.external_customer_id,
            metadata: customerData.metadata
          }
        })
      });

      console.log('✅ [KapsoPlatform] Cliente creado exitosamente:', response.data.id);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ [KapsoPlatform] Error creando cliente:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener cliente por ID
   */
  async getCustomer(customerId: string) {
    try {
      console.log('👤 [KapsoPlatform] Obteniendo cliente:', customerId);

      const response = await this.makeRequest<{
        data: {
          id: string;
          name: string;
          external_customer_id: string;
          created_at: string;
          updated_at: string;
        };
      }>(`/customers/${customerId}`);

      console.log('✅ [KapsoPlatform] Cliente obtenido exitosamente');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error obteniendo cliente:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Listar todos los clientes
   */
  async listCustomers() {
    try {
      console.log('👥 [KapsoPlatform] Listando clientes');

      const response = await this.makeRequest<{
        data: Array<{
          id: string;
          name: string;
          external_customer_id: string;
          created_at: string;
          updated_at: string;
        }>;
        pagination: {
          page: number;
          limit: number;
          total_count: number;
        };
      }>('/customers');

      console.log('✅ [KapsoPlatform] Clientes listados exitosamente:', response.data.length);
      return { success: true, data: response.data, pagination: response.pagination };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error listando clientes:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Crear link de configuración para que el cliente conecte su WhatsApp
   */
  async createSetupLink(setupLinkData: SetupLinkData) {
    try {
      console.log('🔗 [KapsoPlatform] Creando link de configuración para cliente:', setupLinkData.customer_id);

      // Según documentación: POST /customers/{customer_id}/setup_links
      const requestBody = {
        setup_link: {
          success_redirect_url: setupLinkData.success_redirect_url,
          failure_redirect_url: setupLinkData.failure_redirect_url,
          allowed_connection_types: setupLinkData.allowed_connection_types || ['coexistence', 'dedicated'],
          theme_config: setupLinkData.theme_config,
          expires_in: setupLinkData.expires_in || 86400, // 24 horas por defecto
          metadata: setupLinkData.metadata
        }
      };
      console.log('📦 [KapsoPlatform] Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await this.makeRequest<{
        data: {
          id: string;
          url: string;
          customer_id: string;
          expires_at: string;
          created_at: string;
        };
      }>(`/customers/${setupLinkData.customer_id}/setup_links`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      console.log('✅ [KapsoPlatform] Link de configuración creado exitosamente:', response.data.url);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ [KapsoPlatform] Error creando link de configuración:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar mensaje en nombre de un cliente
   */
  async sendMessageOnBehalf(customerId: string, messageData: MessageData) {
    try {
      console.log('📤 [KapsoPlatform] Enviando mensaje en nombre del cliente:', customerId);

      // Según documentación: body debe tener customer_id y message
      const response = await this.makeRequest<{
        data: {
          id: string;
          status: string;
          created_at: string;
        };
      }>('/whatsapp_messages', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,  // O usar whatsapp_config_id para configuración específica
          message: {
            phone_number: messageData.phone_number,
            content: messageData.content,
            message_type: messageData.message_type || 'text',
            template: messageData.template
          }
        })
      });

      console.log('✅ [KapsoPlatform] Mensaje enviado exitosamente');
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('❌ [KapsoPlatform] Error enviando mensaje:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Crear webhook para un cliente
   */
  async createWebhook(customerId: string, webhookData: WebhookData) {
    try {
      console.log('🔗 [KapsoPlatform] Creando webhook para cliente:', customerId);

      const response = await this.makeRequest<{
        data: {
          id: string;
          url: string;
          events: string[];
          created_at: string;
        };
      }>('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          ...webhookData
        })
      });

      console.log('✅ [KapsoPlatform] Webhook creado exitosamente');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error creando webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Crear broadcast para múltiples clientes
   */
  async createBroadcast(broadcastData: BroadcastData) {
    try {
      console.log('📢 [KapsoPlatform] Creando broadcast:', broadcastData.name);

      const response = await this.makeRequest<{
        data: {
          id: string;
          name: string;
          status: string;
          recipients_count: number;
          created_at: string;
        };
      }>('/broadcasts', {
        method: 'POST',
        body: JSON.stringify(broadcastData)
      });

      console.log('✅ [KapsoPlatform] Broadcast creado exitosamente');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error creando broadcast:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar broadcast
   */
  async sendBroadcast(broadcastId: string) {
    try {
      console.log('📢 [KapsoPlatform] Enviando broadcast:', broadcastId);

      const response = await this.makeRequest<{
        data: {
          id: string;
          status: string;
          sent_at: string;
        };
      }>(`/broadcasts/${broadcastId}/send`, {
        method: 'POST'
      });

      console.log('✅ [KapsoPlatform] Broadcast enviado exitosamente');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error enviando broadcast:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Listar números de teléfono conectados
   */
  async listPhoneNumbers() {
    try {
      console.log('📱 [KapsoPlatform] Listando números de teléfono');

      const response = await this.makeRequest<{
        data: Array<{
          id: string;
          phone_number: string;
          display_name: string;
          status: string;
          connection_type: 'coexistence' | 'dedicated';
        }>;
      }>('/phone_numbers');

      console.log('✅ [KapsoPlatform] Números listados exitosamente:', response.data.length);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error listando números:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener estado de salud de un número
   */
  async checkPhoneHealth(phoneNumberId: string) {
    try {
      console.log('🏥 [KapsoPlatform] Verificando salud del número:', phoneNumberId);

      const response = await this.makeRequest<{
        data: {
          id: string;
          status: string;
          health_score: number;
          last_checked: string;
        };
      }>(`/phone_numbers/${phoneNumberId}/health`);

      console.log('✅ [KapsoPlatform] Estado de salud obtenido exitosamente');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [KapsoPlatform] Error verificando salud:', error);
      return { success: false, error: error.message };
    }
  }
}