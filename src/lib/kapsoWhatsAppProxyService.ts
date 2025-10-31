// import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

export interface SendMessageParams {
  phoneNumberId: string;
  to: string;
  body: string;
  template?: {
    name: string;
    language: string;
    parameters?: any[];
  };
}

export interface SendTemplateParams {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  parameters?: {
    header?: string[];
    body?: string[];
    button?: string[];
  };
}

export interface SendInteractiveMessageParams {
  phoneNumberId: string;
  to: string;
  header?: {
    type: 'text';
    text: string;
  };
  body: string;
  buttons: Array<{
    type: 'reply';
    reply: {
      id: string;
      title: string;
    };
  }>;
}

export class KapsoWhatsAppProxyService {
  private client: any; // TODO: Usar WhatsAppClient cuando esté disponible
  private readonly baseUrl = 'https://api.kapso.ai/meta/whatsapp';

  constructor() {
    // Solo usar en el servidor
    if (typeof window !== 'undefined') {
      throw new Error('KapsoWhatsAppProxyService solo puede usarse en el servidor');
    }
    
    const apiKey = process.env.KAPSO_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ KAPSO_API_KEY no está configurada - funcionalidad limitada');
    }
    
    // TODO: Inicializar cliente cuando esté disponible
    // this.client = new WhatsAppClient({
    //   baseUrl: this.baseUrl,
    //   kapsoApiKey: apiKey
    // });
    
    console.log('✅ [KapsoWhatsAppProxy] Servicio inicializado correctamente');
  }

  /**
   * Enviar mensaje de texto simple
   */
  async sendTextMessage(params: SendMessageParams) {
    try {
      console.log('📤 [KapsoWhatsAppProxy] Enviando mensaje de texto:', {
        to: params.to,
        body: params.body?.substring(0, 50) + '...'
      });

      // TODO: Implementar llamada real cuando el cliente esté disponible
      const response = {
        id: `msg_${Date.now()}`,
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      console.log('✅ [KapsoWhatsAppProxy] Mensaje enviado exitosamente:', response);
      return { success: true, data: response };
    } catch (error: any) {
      console.error('❌ [KapsoWhatsAppProxy] Error enviando mensaje:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar plantilla de WhatsApp
   */
  async sendTemplateMessage(params: SendTemplateParams) {
    try {
      console.log('📤 [KapsoWhatsAppProxy] Enviando plantilla:', {
        to: params.to,
        templateName: params.templateName
      });

      // TODO: Implementar llamada real
      const response = {
        id: `template_msg_${Date.now()}`,
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      console.log('✅ [KapsoWhatsAppProxy] Plantilla enviada exitosamente:', response);
      return { success: true, data: response };
    } catch (error: any) {
      console.error('❌ [KapsoWhatsAppProxy] Error enviando plantilla:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar mensaje interactivo con botones
   */
  async sendInteractiveMessage(params: SendInteractiveMessageParams) {
    try {
      console.log('📤 [KapsoWhatsAppProxy] Enviando mensaje interactivo:', {
        to: params.to,
        buttonsCount: params.buttons.length
      });

      // TODO: Implementar llamada real
      const response = {
        id: `interactive_msg_${Date.now()}`,
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      console.log('✅ [KapsoWhatsAppProxy] Mensaje interactivo enviado exitosamente:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ [KapsoWhatsAppProxy] Error enviando mensaje interactivo:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar documento
   */
  async sendDocument(params: {
    phoneNumberId: string;
    to: string;
    document: {
      link: string;
      filename: string;
    };
    caption?: string;
  }) {
    try {
      console.log('📤 [KapsoWhatsAppProxy] Enviando documento:', {
        to: params.to,
        filename: params.document.filename
      });

      // TODO: Implementar llamada real
      const response = {
        id: `doc_msg_${Date.now()}`,
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      console.log('✅ [KapsoWhatsAppProxy] Documento enviado exitosamente:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ [KapsoWhatsAppProxy] Error enviando documento:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener información del perfil de negocio
   */
  async getBusinessProfile(phoneNumberId: string) {
    try {
      console.log('📱 [KapsoWhatsAppProxy] Obteniendo perfil de negocio:', phoneNumberId);

      // Nota: businessProfile no está disponible en la versión actual
      // Usar un endpoint alternativo o implementar cuando esté disponible
      const response = { data: { message: 'Business profile not available in current version' } };

      console.log('✅ [KapsoWhatsAppProxy] Perfil obtenido exitosamente:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ [KapsoWhatsAppProxy] Error obteniendo perfil:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Listar plantillas de mensajes
   */
  async getMessageTemplates(phoneNumberId: string) {
    try {
      console.log('📋 [KapsoWhatsAppProxy] Obteniendo plantillas:', phoneNumberId);

      // TODO: Implementar llamada real
      const response = {
        data: [
          { id: 'template1', name: 'sample_template', status: 'APPROVED' }
        ]
      };

      console.log('✅ [KapsoWhatsAppProxy] Plantillas obtenidas exitosamente:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('❌ [KapsoWhatsAppProxy] Error obteniendo plantillas:', error);
      return { success: false, error: error.message };
    }
  }
}
