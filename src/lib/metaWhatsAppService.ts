import { supabase } from './supabase/client';
import { WhatsAppErrorHandler, WhatsAppError } from './whatsappErrorHandler';
import { SupabaseClientFactory } from './supabase/clientFactory';
import { logger } from './logger';

interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  openaiApiKey?: string;
}

export class MetaWhatsAppService {
  private config!: MetaConfig;
  private isEnabled: boolean = false;
  private isSimulationMode: boolean = false;
  private initialized: boolean = false;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor() {
    this.initializeBasic();
  }

  private initializeBasic() {
    const accessToken = process.env.WHATSAPP_API_KEY;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (accessToken && phoneNumberId && businessAccountId) {
      this.config = {
        accessToken,
        phoneNumberId,
        businessAccountId,
        openaiApiKey: process.env.OPENAI_API_KEY
      };
      
      this.isEnabled = true;
      this.isSimulationMode = false;
      this.initialized = true;
      
      logger.info('MetaWhatsApp', 'Servicio inicializado en modo producción');
    } else {
      this.isEnabled = false;
      this.isSimulationMode = true;
      this.initialized = true;
      
      logger.warn('MetaWhatsApp', 'Servicio en modo simulación - variables de entorno faltantes');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const supabaseClient = SupabaseClientFactory.create();
      const { data: config, error } = await supabaseClient
        .from('whatsapp_configs')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error || !config) {
        logger.warn('MetaWhatsApp', 'No se encontró configuración activa en Supabase');
        return;
      }

      this.config = {
        accessToken: config.access_token,
        phoneNumberId: config.phone_number_id,
        businessAccountId: config.business_account_id,
        openaiApiKey: process.env.OPENAI_API_KEY
      };

      this.isEnabled = true;
      this.isSimulationMode = false;
      this.initialized = true;
      
      logger.info('MetaWhatsApp', 'Configuración cargada desde Supabase');
    } catch (error) {
      logger.error('MetaWhatsApp', 'Error inicializando desde Supabase', error);
      this.isSimulationMode = true;
    }
  }

  // Enviar mensaje simple
  async sendMessage(to: string, content: string, userId?: string): Promise<any> {
    await this.initialize();

    if (!this.isEnabled) {
      logger.warn('MetaWhatsApp', 'Servicio deshabilitado, usando simulación');
      return {
        success: false,
        message: 'Servicio deshabilitado',
        simulated: true
      };
    }

    if (this.isSimulationMode) {
      logger.info('MetaWhatsApp', 'Modo simulación activo');
      return {
        success: true,
        message: content,
        simulated: true
      };
    }

    // Modo real
    logger.debug('MetaWhatsApp', `Enviando mensaje a ${to}`);

    try {
      // Normalizar número de teléfono
      const { PhoneNumberService } = await import('./phoneNumberService');
      let normalizedPhone = PhoneNumberService.normalizeUnified(to);
      
      if (!normalizedPhone) {
        logger.error('MetaWhatsApp', 'No se pudo normalizar el número', to);
        return null;
      }

      const requestBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: {
          body: content
        }
      };

      logger.debug('MetaWhatsApp', 'Request body preparado', { 
        to: normalizedPhone, 
        messageLength: content.length 
      });

      const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText);
        
        logger.apiError('MetaWhatsApp', 'POST', '/messages', errorData);
        
        const handledError = WhatsAppErrorHandler.handleError(errorData, {
          phoneNumber: normalizedPhone,
          messageType: 'text',
          attempt: 1,
          maxRetries: 3
        });
        throw new Error(handledError.userMessage);
      }

      const result = await response.json();
      logger.info('MetaWhatsApp', 'Mensaje enviado exitosamente', { 
        to: normalizedPhone,
        messageId: result.messages?.[0]?.id 
      });
      
      return result;
    } catch (error) {
      logger.error('MetaWhatsApp', 'Error enviando mensaje', error);
      throw error;
    }
  }

  // Enviar mensaje con template
  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    templateParams: string[] = [], 
    userId?: string
  ): Promise<any> {
    await this.initialize();

    if (!this.isEnabled || this.isSimulationMode) {
      logger.info('MetaWhatsApp', 'Template simulado', { templateName, params: templateParams });
      return {
        success: true,
        template: templateName,
        params: templateParams,
        simulated: true
      };
    }

    logger.debug('MetaWhatsApp', `Enviando template ${templateName} a ${to}`);

    try {
      const { PhoneNumberService } = await import('./phoneNumberService');
      let normalizedPhone = PhoneNumberService.normalizeUnified(to);
      
      if (!normalizedPhone) {
        logger.error('MetaWhatsApp', 'No se pudo normalizar el número para template', to);
        return null;
      }

      const requestBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'es'
          },
          components: templateParams.length > 0 ? [{
            type: 'body',
            parameters: templateParams.map(param => ({
              type: 'text',
              text: param
            }))
          }] : []
        }
      };

      const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = JSON.parse(errorText);
        
        logger.apiError('MetaWhatsApp', 'POST', '/messages/template', errorData);
        
        const handledError = WhatsAppErrorHandler.handleError(errorData, {
          phoneNumber: normalizedPhone,
          messageType: 'template',
          attempt: 1,
          maxRetries: 3
        });
        throw new Error(handledError.userMessage);
      }

      const result = await response.json();
      logger.info('MetaWhatsApp', 'Template enviado exitosamente', { 
        to: normalizedPhone,
        template: templateName,
        messageId: result.messages?.[0]?.id 
      });
      
      return result;
    } catch (error) {
      logger.error('MetaWhatsApp', 'Error enviando template', error);
      throw error;
    }
  }

  // Enviar documento
  async sendDocument(
    to: string, 
    documentUrl: string, 
    filename: string, 
    caption?: string, 
    userId?: string
  ): Promise<any> {
    await this.initialize();

    if (!this.isEnabled || this.isSimulationMode) {
      logger.info('MetaWhatsApp', 'Documento simulado', { filename, url: documentUrl });
      return {
        success: true,
        filename,
        url: documentUrl,
        simulated: true
      };
    }

    logger.debug('MetaWhatsApp', `Enviando documento ${filename} a ${to}`);

    try {
      const { PhoneNumberService } = await import('./phoneNumberService');
      let normalizedPhone = PhoneNumberService.normalizeUnified(to);
      
      if (!normalizedPhone) {
        logger.error('MetaWhatsApp', 'No se pudo normalizar el número para documento', to);
        return null;
      }

      const requestBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'document',
        document: {
          link: documentUrl,
          filename: filename,
          ...(caption && { caption })
        }
      };

      const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          logger.error('MetaWhatsApp', 'Error parseando respuesta de error', { errorText, parseError });
          throw new Error(`Error enviando documento: ${errorText}`);
        }
        
        logger.apiError('MetaWhatsApp', 'POST', '/messages/document', errorData);
        logger.error('MetaWhatsApp', 'Detalles del error al enviar documento', {
          status: response.status,
          statusText: response.statusText,
          errorCode: errorData.error?.code,
          errorMessage: errorData.error?.message,
          errorTitle: errorData.error?.title,
          documentUrl: documentUrl,
          filename: filename,
          to: normalizedPhone
        });
        
        const handledError = WhatsAppErrorHandler.handleError(errorData.error || errorData, {
          phoneNumber: normalizedPhone,
          messageType: 'text',
          attempt: 1,
          maxRetries: 3
        });
        throw new Error(handledError.userMessage);
      }

      const result = await response.json();
      logger.info('MetaWhatsApp', 'Documento enviado exitosamente', { 
        to: normalizedPhone,
        filename,
        messageId: result.messages?.[0]?.id 
      });
      
      return result;
    } catch (error) {
      logger.error('MetaWhatsApp', 'Error enviando documento', error);
      throw error;
    }
  }

  // Verificar estado del servicio
  getStatus(): { enabled: boolean; simulationMode: boolean; initialized: boolean } {
    return {
      enabled: this.isEnabled,
      simulationMode: this.isSimulationMode,
      initialized: this.initialized
    };
  }

  // Obtener configuración (sin datos sensibles)
  getConfig(): { phoneNumberId: string; businessAccountId: string } | null {
    if (!this.initialized || !this.config) return null;
    
    return {
      phoneNumberId: this.config.phoneNumberId,
      businessAccountId: this.config.businessAccountId
    };
  }
}
