import { getSupabaseServerClient } from './supabase/serverClient';
import { metaWhatsAppService } from './metaWhatsAppService';
import { ORDER_STATUS } from './orderConstants';
import { ExtensibleOrderFlowService } from './extensibleOrderFlowService';

/**
 * Servicio de flujo de órdenes para el SERVIDOR
 * Solo se ejecuta en el servidor donde están disponibles las variables de entorno
 */
export class ServerOrderFlowService {
  private static instance: ServerOrderFlowService;
  private supabase = getSupabaseServerClient();

  private constructor() {}

  public static getInstance(): ServerOrderFlowService {
    if (!ServerOrderFlowService.instance) {
      ServerOrderFlowService.instance = new ServerOrderFlowService();
    }
    return ServerOrderFlowService.instance;
  }

  /**
   * Crear orden y enviar notificación (SOLO SERVIDOR)
   */
  async createOrderAndNotify(order: any, userId: string): Promise<{ success: boolean; orderId?: string; errors?: string[]; message?: string }> {
    try {
      console.log('🚀 [ServerOrderFlow] Creando orden y enviando notificación:', order.id);

      // 🔧 FIX: Primero verificar si la orden ya existe para evitar duplicados
      const { data: existingOrder } = await this.supabase
        .from('orders')
        .select('id')
        .eq('id', order.id)
        .single();

      let orderId: string;
      let orderData: any;

      if (existingOrder) {
        // La orden ya existe, solo enviar notificación
        console.log('⚠️ [ServerOrderFlow] Orden ya existe, saltando creación:', order.id);
        orderId = existingOrder.id;
        
        // Obtener datos completos de la orden existente
        const { data: fullOrder } = await this.supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        orderData = fullOrder;
      } else {
        // La orden no existe, crearla
        const orderResult = await this.createOrder(order, userId);
        if (!orderResult.success) {
          return { success: false, errors: orderResult.errors };
        }
        orderId = orderResult.orderId!;
        orderData = orderResult.order!;
        console.log('✅ [ServerOrderFlow] Orden creada:', orderId);
      }

      // 2. Obtener datos del proveedor
      const providerResult = await this.getProviderData(order.providerId);
      if (!providerResult.success) {
        console.log('⚠️ [ServerOrderFlow] No se pudo obtener datos del proveedor, pero orden creada');
        return { 
          success: true, 
          orderId, 
          message: 'Orden creada, pero no se pudo enviar notificación al proveedor' 
        };
      }

      const provider = providerResult.provider!;
      console.log('✅ [ServerOrderFlow] Datos del proveedor obtenidos:', provider.name);

      // 3. Enviar notificación por WhatsApp
      const notificationResult = await this.sendOrderNotification(
        provider.phone, 
        orderData, 
        provider
      );

      if (!notificationResult.success) {
        console.log('⚠️ [ServerOrderFlow] Notificación falló, pero orden creada:', notificationResult.errors);
        return { 
          success: true, 
          orderId, 
          message: 'Orden creada, pero no se pudo enviar notificación al proveedor' 
        };
      }

      console.log('✅ [ServerOrderFlow] Orden creada y notificación enviada exitosamente');
      return { 
        success: true, 
        orderId, 
        message: 'Orden creada y notificación enviada exitosamente' 
      };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error en createOrderAndNotify:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error desconocido'] 
      };
    }
  }

  /**
   * Crear orden en la base de datos
   */
  private async createOrder(order: any, userId: string): Promise<{ success: boolean; orderId?: string; order?: any; errors?: string[] }> {
    try {
      console.log('🔍 [ServerOrderFlow] Datos de orden recibidos:', {
        id: order.id,
        providerId: order.providerId,
        userId: userId,
        hasId: !!order.id
      });

      const orderData = {
        id: order.id,
        user_id: userId,
        provider_id: order.providerId,
        order_number: order.orderNumber, // Agregar order_number
        items: order.items,
        status: ORDER_STATUS.STANDBY,
        notes: order.notes || '',
        desired_delivery_date: order.desiredDeliveryDate,
        desired_delivery_time: order.desiredDeliveryTime,
        payment_method: order.paymentMethod || 'efectivo', // 🔧 FIX: Incluir método de pago
        total_amount: order.totalAmount || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 [ServerOrderFlow] Insertando orden:', {
        id: orderData.id,
        order_number: orderData.order_number,
        provider_id: orderData.provider_id,
        user_id: orderData.user_id
      });

      // Idempotente por id (evitar duplicados si hay doble disparo)
      const { data, error } = await this.supabase
        .from('orders')
        .upsert(orderData, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('❌ [ServerOrderFlow] Error creando orden:', error);
        return { success: false, errors: [error.message] };
      }

      return { success: true, orderId: data.id, order: data };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error en createOrder:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error creando orden'] 
      };
    }
  }

  /**
   * Obtener datos del proveedor
   */
  private async getProviderData(providerId: string): Promise<{ success: boolean; provider?: any; errors?: string[] }> {
    try {
      console.log('🔍 [ServerOrderFlow] Obteniendo datos del proveedor:', providerId);

      const { data, error } = await this.supabase
        .from('providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (error) {
        console.error('❌ [ServerOrderFlow] Error obteniendo proveedor:', error);
        return { success: false, errors: [error.message] };
      }

      return { success: true, provider: data };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error en getProviderData:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error obteniendo proveedor'] 
      };
    }
  }

  /**
   * Enviar notificación de orden por WhatsApp
   */
  private async sendOrderNotification(phone: string, order: any, provider: any): Promise<{ success: boolean; errors?: string[]; pendingApproval?: boolean; fallbackSent?: boolean }> {
    try {
      console.log('📤 [ServerOrderFlow] Iniciando envío de notificación:', {
        phone,
        providerName: provider.name,
        contactName: provider.contact_name,
        orderId: order.id
      });

      const templateVariables = {
        provider_name: provider.name || 'Proveedor',
        contact_name: provider.contact_name || provider.name || 'Contacto'
      };

      console.log('📤 [ServerOrderFlow] Variables del template:', templateVariables);

      // ✅ Asegurar que los templates existan antes de enviar
      try {
        const { whatsappTemplateSetupService } = await import('./whatsappTemplateSetupService');
        await whatsappTemplateSetupService.setupTemplatesForUser(order.user_id);
      } catch (templateSetupError) {
        console.error('⚠️ [ServerOrderFlow] No se pudieron preparar los templates automáticamente:', templateSetupError);
      }

      // ✅ ENVIAR TEMPLATE evio_orden usando la API de Kapso
      // evio_orden actualmente tiene 1 parámetro en BODY -> usar solo el nombre del contacto
      const templateResult = await this.sendTemplateMessage(
        phone,
        'evio_orden',
        'es_AR',
        [templateVariables.contact_name],
        order.user_id
      );

      console.log('📤 [ServerOrderFlow] Resultado del envío de template:', templateResult);

      // Si está pendiente de aprobación, intentar fallback con texto regular
      if (!templateResult.success && (templateResult as any).code === 131037) {
        try {
          // Obtener phone_number_id del usuario
          const { data: config } = await this.supabase
            .from('user_whatsapp_config')
            .select('phone_number_id')
            .eq('user_id', order.user_id)
            .eq('is_active', true)
            .single();

          const phoneNumberId = config?.phone_number_id;
          if (phoneNumberId) {
            const { WhatsAppClient } = await import('@kapso/whatsapp-cloud-api');
            const whatsappClient = new WhatsAppClient({
              baseUrl: 'https://api.kapso.ai/meta/whatsapp',
              kapsoApiKey: process.env.KAPSO_API_KEY!,
              graphVersion: 'v24.0'
            });

            const body = `Buen día ${templateVariables.contact_name}! Espero que andes bien!\nEn cuanto me confirmes, paso el pedido de esta semana.`;

            const textResult = await whatsappClient.messages.sendText({
              phoneNumberId,
              to: phone,
              body
            });

            console.log('✅ [ServerOrderFlow] Fallback texto enviado:', textResult.messages?.[0]?.id);
            return { success: true, pendingApproval: true, fallbackSent: true };
          }
        } catch (fallbackError) {
          console.warn('⚠️ [ServerOrderFlow] Fallback de texto falló:', fallbackError);
          return { success: false, errors: ['Pendiente de aprobación y no se pudo enviar texto'], pendingApproval: true, fallbackSent: false };
        }
      }

      return { success: !!templateResult.success, pendingApproval: false };

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error enviando notificación:', error);
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error enviando notificación'] 
      };
    }
  }

  /**
   * Enviar template de WhatsApp usando la API de Kapso
   */
  private async sendTemplateMessage(
    phone: string, 
    templateName: string, 
    languageCode: string,
    parameters: string[],
    userId: string
  ): Promise<{ success: boolean; error?: string; code?: number }> {
    try {
      console.log('📤 [ServerOrderFlow] Enviando template:', { phone, templateName, languageCode, parameters });

      // Obtener phone_number_id del usuario
      const { data: config } = await this.supabase
        .from('user_whatsapp_config')
        .select('phone_number_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!config?.phone_number_id) {
        throw new Error('No se encontró configuración de WhatsApp para el usuario');
      }

      const phoneNumberId = config.phone_number_id;

      // Usar WABA_ID configurado (evitar GET con campo removido por Meta)
      const businessAccountId: string | undefined = process.env.WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

      // Usar WhatsAppClient de Kapso SDK para enviar template
      const { WhatsAppClient, buildTemplateSendPayload } = await import('@kapso/whatsapp-cloud-api');
      const whatsappClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: process.env.KAPSO_API_KEY!,
        graphVersion: 'v24.0'
      });

      // Ajustar parámetros al número esperado (consultar definición del template)
      try {
        if (businessAccountId) {
          const tplResp = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates?limit=100`, {
            headers: { 'X-API-Key': process.env.KAPSO_API_KEY as string }
          });
          if (tplResp.ok) {
            const tplData = await tplResp.json();
            const all = (tplData?.data || tplData?.message_templates || []) as any[];
            const match = all.find((t: any) => t?.name === templateName && (t?.language === languageCode || t?.languages?.includes?.(languageCode)));

            if (match?.components) {
              const comps: any[] = match.components;

              const pick = (idx: number): string => parameters[idx] ?? parameters[parameters.length - 1] ?? '';

              const headerComp = comps.find(c => c.type === 'HEADER' && (!c.format || c.format === 'TEXT'));
              const headerPlaceholders = typeof headerComp?.text === 'string' ? (headerComp.text.match(/\{\{\d+\}\}/g) || []).length : 0;

              const bodyComp = comps.find(c => c.type === 'BODY');
              const bodyPlaceholders = typeof bodyComp?.text === 'string' ? (bodyComp.text.match(/\{\{\d+\}\}/g) || []).length : 0;

              // Reconstruir options según definición
              const templateOptionsDyn: any = { name: templateName, language: languageCode };
              if (headerPlaceholders > 0) {
                templateOptionsDyn.header = { type: 'text', text: pick(0) };
              }
              if (bodyPlaceholders > 0) {
                templateOptionsDyn.body = Array.from({ length: bodyPlaceholders }, (_, i) => ({ type: 'text', text: pick(headerPlaceholders + i) }));
              }

              // Sustituir options calculadas
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const _old = parameters;
              // Usaremos templateOptionsDyn más abajo
              const templatePayloadDyn = buildTemplateSendPayload(templateOptionsDyn);
              const resultDyn = await whatsappClient.messages.sendTemplate({ phoneNumberId, to: phone, template: templatePayloadDyn });
              console.log('✅ [ServerOrderFlow] Template enviado (definición dinámica):', resultDyn.messages?.[0]?.id);
              return { success: true };
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ [ServerOrderFlow] No se pudo leer definición del template, usando envío básico');
      }

      // Construir payload del template usando buildTemplateSendPayload
      const templateOptions: any = {
        name: templateName,
        language: languageCode
      };

      // Agregar parámetros al body si existen
      if (parameters && parameters.length > 0) {
        templateOptions.body = parameters.map(param => ({
          type: 'text',
          text: param
        }));
      }

      const templatePayload = buildTemplateSendPayload(templateOptions);

      const result = await whatsappClient.messages.sendTemplate({
        phoneNumberId,
        to: phone,
        template: templatePayload
      });

      console.log('✅ [ServerOrderFlow] Template enviado exitosamente:', result.messages?.[0]?.id);
      return { success: true };

    } catch (error: any) {
      console.error('❌ [ServerOrderFlow] Error enviando template:', error);
      return {
        success: false,
        error: error.message || 'Error enviando template',
        code: typeof error?.code === 'number' ? error.code : undefined
      };
    }
  }
}

export const serverOrderFlowService = ServerOrderFlowService.getInstance();
