import { metaWhatsAppService } from './metaWhatsAppService';
import { OrderNotificationService } from './orderNotificationService';
import { templateStateService } from './templateStateService';

// Tipos para los eventos de webhook
interface WebhookEvent {
  object: string;
  entry: WebhookEntry[];
}

interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

interface WebhookChange {
  value: WebhookValue;
  field: string;
}

interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  messages?: MessageEvent[];
  message_template_components_update?: TemplateComponentUpdate[];
  message_template_quality_update?: TemplateQualityUpdate[];
  message_template_status_update?: TemplateStatusUpdate[];
}

interface MessageEvent {
  from: string;
  to: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  document?: {
    id: string;
    filename: string;
    mime_type: string;
  };
  content?: string;
}

interface TemplateComponentUpdate {
  template_id: string;
  component_type: string;
  status: string;
  timestamp: string;
}

interface TemplateQualityUpdate {
  template_id: string;
  quality_rating: string;
  timestamp: string;
}

interface TemplateStatusUpdate {
  template_id: string;
  status: string;
  timestamp: string;
}

// Clase principal para manejo de webhooks
export class WebhookService {
  private static instance: WebhookService;
  private lastProcessedTimestamp: number = 0;
  private readonly MIN_PROCESSING_INTERVAL = 1000; // 1 segundo mínimo entre procesamientos

  private constructor() {}

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  /**
   * Procesa un webhook completo de WhatsApp Business API
   */
  public async processWebhook(body: WebhookEvent): Promise<{ success: boolean; processedEvents: number }> {
    try {
      console.log('🔄 Procesando webhook de WhatsApp Business API');
      console.log('📊 Estructura del webhook:', {
        object: body.object,
        entryCount: body.entry?.length || 0,
        hasEntry: !!body.entry,
        entryTypes: body.entry?.map(e => ({
          id: e.id,
          changesCount: e.changes?.length || 0,
          changeFields: e.changes?.map(c => c.field) || []
        })) || []
      });
      
      // Rate limiting: evitar procesamiento excesivo
      const now = Date.now();
      if (now - this.lastProcessedTimestamp < this.MIN_PROCESSING_INTERVAL) {
        console.log(`⚠️ Rate limiting activo, saltando webhook. Último procesamiento: ${now - this.lastProcessedTimestamp}ms atrás`);
        return { success: true, processedEvents: 0 };
      }
      this.lastProcessedTimestamp = now;
      
      // Validar que el webhook tenga contenido válido
      if (!body.entry || body.entry.length === 0) {
        console.log('⚠️ Webhook sin entradas válidas, ignorando');
        console.log('📊 Contenido completo del webhook:', JSON.stringify(body, null, 2));
        return { success: true, processedEvents: 0 };
      }
      
             // Verificar si hay mensajes reales para procesar
       let hasValidMessages = false;
       let totalMessages = 0;
       let messageDetails: any[] = [];
      
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          console.log(`📡 Analizando cambio: ${change.field}`);
          
          if (change.field === 'messages') {
            const messageCount = change.value.messages?.length || 0;
            totalMessages += messageCount;
            
            if (messageCount > 0) {
              hasValidMessages = true;
              messageDetails = change.value.messages?.map(m => ({
                id: m.id,
                from: m.from,
                type: m.type,
                timestamp: m.timestamp
              })) || [];
              
              console.log(`📊 Mensajes encontrados en cambio:`, {
                count: messageCount,
                details: messageDetails
              });
            } else {
              console.log('⚠️ Campo messages presente pero sin mensajes');
            }
          }
        }
      }
      
      if (!hasValidMessages) {
        console.log('⚠️ Webhook sin mensajes válidos para procesar, ignorando');
        console.log('📊 Resumen del webhook:', {
          totalMessages,
          hasValidMessages,
          messageDetails
        });
        return { success: true, processedEvents: 0 };
      }
      
      if (body.object !== 'whatsapp_business_account') {
        console.log('⚠️ Webhook no es de WhatsApp Business API, ignorando');
        console.log('📊 Object type:', body.object);
        return { success: true, processedEvents: 0 };
      }

      let processedEvents = 0;

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const result = await this.processChange(change);
          if (result.success) {
            processedEvents += result.processedEvents;
          }
        }
      }

      console.log(`✅ Webhook procesado exitosamente. Eventos procesados: ${processedEvents}`);
      return { success: true, processedEvents };

    } catch (error) {
      console.error('💥 Error procesando webhook:', error);
      return { success: false, processedEvents: 0 };
    }
  }

  /**
   * Procesa un cambio específico del webhook
   */
  private async processChange(change: WebhookChange): Promise<{ success: boolean; processedEvents: number }> {
    const { value, field } = change;
    let processedEvents = 0;

    try {
      console.log(`📡 Procesando cambio de campo: ${field}`);
      
      // Log detallado del contenido del cambio
      if (field === 'messages') {
        console.log(`📊 Contenido del cambio messages:`, {
          hasMessages: !!value.messages,
          messageCount: value.messages?.length || 0,
          messageTypes: value.messages?.map(m => m.type) || []
        });
      }

      switch (field) {
        case 'messages':
          if (value.messages && value.messages.length > 0) {
            processedEvents += await this.processMessages(value.messages);
          }
          break;

        case 'message_template_components_update':
          if (value.message_template_components_update && value.message_template_components_update.length > 0) {
            processedEvents += await this.processTemplateComponentsUpdate(value.message_template_components_update);
          }
          break;

        case 'message_template_quality_update':
          if (value.message_template_quality_update && value.message_template_quality_update.length > 0) {
            processedEvents += await this.processTemplateQualityUpdate(value.message_template_quality_update);
          }
          break;

        case 'message_template_status_update':
          if (value.message_template_status_update && value.message_template_status_update.length > 0) {
            processedEvents += await this.processTemplateStatusUpdate(value.message_template_status_update);
          }
          break;

        default:
          console.log(`ℹ️ Campo de webhook no manejado: ${field}`);
          break;
      }

      return { success: true, processedEvents };

    } catch (error) {
      console.error(`💥 Error procesando cambio ${field}:`, error);
      return { success: false, processedEvents: 0 };
    }
  }

  /**
   * Procesa eventos de mensajes
   */
  private async processMessages(messages: MessageEvent[]): Promise<number> {
    let processedCount = 0;
    const processedMessageIds = new Set<string>();

    for (const message of messages) {
      try {
        // Verificar si el mensaje ya fue procesado (protección contra bucles)
        if (processedMessageIds.has(message.id)) {
          console.log(`⚠️ Mensaje ya procesado, saltando: ${message.id}`);
          continue;
        }
        processedMessageIds.add(message.id);

        // Validar y normalizar el número de teléfono
        const normalizedFrom = this.normalizePhoneNumber(message.from);
        if (!this.isValidPhoneNumber(normalizedFrom)) {
          console.error('❌ Formato de teléfono inválido en webhook:', normalizedFrom);
          continue;
        }

        // Extraer contenido del mensaje
        const messageContent = this.extractMessageContent(message);
        
        console.log(`💬 Procesando mensaje de ${normalizedFrom}: ${messageContent.substring(0, 50)}...`);

        // ✅ MEJORA: Filtrado más robusto de mensajes del sistema
        if (message.type === 'text' && 
            (messageContent.startsWith('🛒 *NUEVO PEDIDO*') || 
             messageContent.includes('Se ha recibido un nuevo pedido') ||
             messageContent.includes('Por favor confirma la recepción') ||
             messageContent.includes('NUEVO PEDIDO') ||
             messageContent.includes('nuevo pedido'))) {
          console.log(`⚠️ Mensaje del sistema detectado, saltando procesamiento: ${message.id}`);
          continue;
        }
        
        // Verificar si el mensaje viene de nuestro propio número (evitar bucles)
        if (message.from === process.env.WHATSAPP_PHONE_NUMBER_ID) {
          console.log(`⚠️ Mensaje de nuestro propio número detectado, saltando procesamiento: ${message.id}`);
          continue;
        }

        // Log detallado para debugging
        console.log(`🔍 Analizando mensaje: "${messageContent}" de ${normalizedFrom}`);

        // Validar que el mensaje sea una respuesta válida del proveedor
        if (this.isValidProviderResponse(messageContent)) {
          console.log(`✅ Mensaje válido detectado: "${messageContent}" de ${normalizedFrom}`);
          
          // Procesar mensaje en base de datos
          try {
            await metaWhatsAppService.processIncomingMessage({
              from: normalizedFrom,
              to: message.to || process.env.WHATSAPP_PHONE_NUMBER_ID,
              content: messageContent,
              timestamp: new Date(parseInt(message.timestamp) * 1000),
              id: message.id,
              type: message.type,
              messageType: 'received'
            });
            console.log(`✅ Mensaje procesado en base de datos exitosamente`);
          } catch (dbError) {
            console.error('❌ Error procesando mensaje en base de datos:', dbError);
          }

          // Verificar si es respuesta de proveedor y enviar detalles del pedido
          console.log(`🔍 Iniciando verificación de pedido pendiente para: ${normalizedFrom}`);
          try {
            await this.handleProviderResponse(normalizedFrom, messageContent);
            console.log(`✅ Respuesta de proveedor procesada exitosamente`);
          } catch (responseError) {
            console.error('❌ Error procesando respuesta de proveedor:', responseError);
          }
        } else {
          console.log(`ℹ️ Mensaje no válido para procesamiento: "${messageContent}" de ${normalizedFrom}`);
        }

        processedCount++;

      } catch (error) {
        console.error('💥 Error procesando mensaje individual:', error);
      }
    }

    console.log(`✅ Procesados ${processedCount} mensajes`);
    return processedCount;
  }

  /**
   * Procesa actualizaciones de componentes de templates
   */
  private async processTemplateComponentsUpdate(updates: TemplateComponentUpdate[]): Promise<number> {
    let processedCount = 0;

    for (const update of updates) {
      try {
        console.log(`📋 Actualización de componente de template: ${update.template_id} - ${update.component_type} - ${update.status}`);
        
        // Actualizar el estado del componente usando el TemplateStateService
        await templateStateService.updateTemplateComponent(
          update.template_id,
          update.component_type,
          update.status
        );
        
        processedCount++;

      } catch (error) {
        console.error('💥 Error procesando actualización de componente de template:', error);
      }
    }

    console.log(`✅ Procesadas ${processedCount} actualizaciones de componentes de templates`);
    return processedCount;
  }

  /**
   * Procesa actualizaciones de calidad de templates
   */
  private async processTemplateQualityUpdate(updates: TemplateQualityUpdate[]): Promise<number> {
    let processedCount = 0;

    for (const update of updates) {
      try {
        console.log(`⭐ Actualización de calidad de template: ${update.template_id} - ${update.quality_rating}`);
        
        // Actualizar la calidad del template usando el TemplateStateService
        await templateStateService.updateTemplateQuality(
          update.template_id,
          update.quality_rating
        );
        
        processedCount++;

      } catch (error) {
        console.error('💥 Error procesando actualización de calidad de template:', error);
      }
    }

    console.log(`✅ Procesadas ${processedCount} actualizaciones de calidad de templates`);
    return processedCount;
  }

  /**
   * Procesa actualizaciones de estado de templates
   */
  private async processTemplateStatusUpdate(updates: TemplateStatusUpdate[]): Promise<number> {
    let processedCount = 0;

    for (const update of updates) {
      try {
        console.log(`🔄 Actualización de estado de template: ${update.template_id} - ${update.status}`);
        
        // Actualizar el estado del template usando el TemplateStateService
        await templateStateService.updateTemplateStatus(
          update.template_id,
          update.status
        );
        
        processedCount++;

      } catch (error) {
        console.error('💥 Error procesando actualización de estado de template:', error);
      }
    }

    console.log(`✅ Procesadas ${processedCount} actualizaciones de estado de templates`);
    return processedCount;
  }

  /**
   * Maneja respuestas de proveedores
   */
  private async handleProviderResponse(phoneNumber: string, messageContent: string): Promise<void> {
    try {
      console.log(`🔍 Verificando si es respuesta de proveedor: ${phoneNumber}`);
      
      const pendingOrder = await OrderNotificationService.checkPendingOrder(phoneNumber);
      
      if (pendingOrder?.orderData) {
        console.log(`📝 Encontrado pedido pendiente para ${phoneNumber}:`, {
          orderId: pendingOrder.orderId,
          providerId: pendingOrder.providerId,
          status: pendingOrder.status
        });
        
        console.log(`📝 Procesando respuesta del proveedor para: ${phoneNumber}`);
        const result = await OrderNotificationService.processProviderResponse(phoneNumber, messageContent);
        
        if (result) {
          console.log(`✅ Respuesta del proveedor procesada exitosamente para: ${phoneNumber}`);
        } else {
          console.error(`❌ Error procesando respuesta del proveedor para: ${phoneNumber}`);
        }
      } else {
        console.log(`ℹ️ No hay pedidos pendientes para: ${phoneNumber}`);
      }

    } catch (error) {
      console.error('💥 Error al verificar pedidos pendientes:', error);
    }
  }

  /**
   * Normaliza un número de teléfono
   */
  private normalizePhoneNumber(phone: string): string {
    if (!phone.startsWith('+')) {
      return '+' + phone;
    }
    return phone;
  }

  /**
   * Valida el formato de un número de teléfono
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+54\d{9,11}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Extrae el contenido de un mensaje
   */
  private extractMessageContent(message: MessageEvent): string {
    if (message.text && message.text.body) {
      return message.text.body;
    }
    
    if (message.content) {
      return message.content;
    }
    
    if (message.type === 'image' && message.image) {
      return '[Imagen]';
    }
    
    if (message.type === 'document' && message.document) {
      return `[Documento: ${message.document.filename}]`;
    }
    
    return '[Mensaje no soportado]';
  }

  /**
   * Valida si un mensaje es una respuesta válida del proveedor
   * ✅ MEJORA: Lógica más robusta y logging mejorado
   */
  private isValidProviderResponse(messageContent: string): boolean {
    const normalizedContent = messageContent.toLowerCase().trim();
    
    // Filtrar mensajes del sistema
    if (normalizedContent.includes('🛒 *nuevo pedido*') || 
        normalizedContent.includes('se ha recibido un nuevo pedido') ||
        normalizedContent.includes('por favor confirma la recepción') ||
        normalizedContent.includes('nuevo pedido') ||
        normalizedContent.includes('pedido recibido')) {
      console.log(`🔍 Mensaje del sistema detectado: "${messageContent}" -> INVÁLIDO`);
      return false;
    }
    
    // ✅ MEJORA: Validar que el mensaje tenga contenido significativo
    if (normalizedContent.length < 1) {
      console.log(`🔍 Mensaje vacío detectado -> INVÁLIDO`);
      return false;
    }
    
    // Cualquier otra respuesta del proveedor es válida
    console.log(`🔍 Respuesta del proveedor detectada: "${messageContent}" -> VÁLIDA`);
    return true;
  }

  /**
   * Verifica si el servicio está habilitado
   */
  public isServiceEnabled(): boolean {
    return metaWhatsAppService.isServiceEnabled();
  }
}

// Exportar instancia singleton
export const webhookService = WebhookService.getInstance();
