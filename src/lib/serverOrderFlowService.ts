import { getSupabaseServerClient } from './supabase/serverClient';
import { ORDER_STATUS } from './orderConstants';
import { ExtensibleOrderFlowService } from './extensibleOrderFlowService';
import { PhoneNumberService } from './phoneNumberService';

/**
 * Servicio de flujo de órdenes para el SERVIDOR
 * Solo se ejecuta en el servidor donde están disponibles las variables de entorno
 */
export class ServerOrderFlowService {
  private static instance: ServerOrderFlowService;
  private supabase = getSupabaseServerClient() as any;

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
      console.log('🚀 [ServerOrderFlow] ===== INICIANDO createOrderAndNotify =====');
      console.log('🔍 [ServerOrderFlow] Datos recibidos:', {
        orderId: order?.id,
        orderNumber: order?.orderNumber,
        providerId: order?.providerId,
        userId: userId,
        hasItems: !!order?.items,
        itemsCount: order?.items?.length || 0
      });

      // 🔧 FIX: Usar upsert directamente para evitar condiciones de carrera
      // No verificar antes porque puede haber llamadas simultáneas que pasen la verificación
      const orderResult = await this.createOrder(order, userId);
      if (!orderResult.success) {
        console.error('❌ [ServerOrderFlow] Error en createOrder:', orderResult.errors);
        return { success: false, errors: orderResult.errors };
      }
      const orderId = orderResult.orderId!;
      const orderData = orderResult.order!;
      console.log('✅ [ServerOrderFlow] Orden creada/actualizada:', orderId);

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
      console.log('🔍 [ServerOrderFlow] auto_order_flow_enabled:', provider.auto_order_flow_enabled);
      console.log('🔍 [ServerOrderFlow] Tipo de auto_order_flow_enabled:', typeof provider.auto_order_flow_enabled);

        // 3. Verificar si el flujo automático está habilitado
        const autoOrderFlowEnabled = provider.auto_order_flow_enabled !== undefined 
          ? provider.auto_order_flow_enabled 
          : true; // Por defecto true si no está definido

        console.log('🔍 [ServerOrderFlow] Valor final de autoOrderFlowEnabled:', autoOrderFlowEnabled);
        console.log('🔍 [ServerOrderFlow] Evaluando condición: !autoOrderFlowEnabled =', !autoOrderFlowEnabled);

        if (!autoOrderFlowEnabled) {
          console.log('⚠️ [ServerOrderFlow] ⛔⛔⛔ Flujo automático DESHABILITADO para este proveedor. Orden creada sin enviar notificación.');
          console.log('📋 [ServerOrderFlow] Proveedor:', provider.name, '| auto_order_flow_enabled (raw):', provider.auto_order_flow_enabled);
          console.log('📋 [ServerOrderFlow] Tipo de auto_order_flow_enabled:', typeof provider.auto_order_flow_enabled);
          return {
            success: true,
            orderId,
            message: 'Orden creada. Flujo automático deshabilitado para este proveedor'
          };
        }

        console.log('✅ [ServerOrderFlow] ✅✅✅ Flujo automático HABILITADO, procediendo a enviar notificación');
        console.log('📤 [ServerOrderFlow] Llamando a sendOrderNotification con:', {
          phone: provider.phone,
          orderId: orderData.id,
          providerName: provider.name
        });

        // 4. Enviar notificación por WhatsApp
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

      await this.savePendingOrder(orderData, provider);

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
      console.log('🔍 [ServerOrderFlow] ===== INICIANDO createOrder =====');
      console.log('🔍 [ServerOrderFlow] Datos de orden recibidos:', {
        id: order.id,
        orderNumber: order.orderNumber,
        providerId: order.providerId,
        userId: userId,
        hasId: !!order.id,
        hasItems: !!order.items,
        itemsType: Array.isArray(order.items) ? 'array' : typeof order.items,
        itemsLength: Array.isArray(order.items) ? order.items.length : 'N/A'
      });

      // Validar campos requeridos
      if (!order.id) {
        console.error('❌ [ServerOrderFlow] Error: order.id es requerido');
        return { success: false, errors: ['order.id es requerido'] };
      }
      if (!order.providerId) {
        console.error('❌ [ServerOrderFlow] Error: order.providerId es requerido');
        return { success: false, errors: ['order.providerId es requerido'] };
      }
      if (!order.orderNumber) {
        console.error('❌ [ServerOrderFlow] Error: order.orderNumber es requerido');
        return { success: false, errors: ['order.orderNumber es requerido'] };
      }

      // 🔧 FIX: Convertir desiredDeliveryDate a string ISO si es un objeto Date
      let desiredDeliveryDateValue = null;
      if (order.desiredDeliveryDate) {
        if (order.desiredDeliveryDate instanceof Date) {
          desiredDeliveryDateValue = order.desiredDeliveryDate.toISOString();
        } else if (typeof order.desiredDeliveryDate === 'string') {
          desiredDeliveryDateValue = order.desiredDeliveryDate;
        } else {
          // Intentar convertir si es un formato válido
          try {
            desiredDeliveryDateValue = new Date(order.desiredDeliveryDate).toISOString();
          } catch {
            desiredDeliveryDateValue = null;
          }
        }
      }

      // 🔧 FIX: Convertir dueDate a string ISO si es un objeto Date
      let dueDateValue = null;
      if (order.dueDate) {
        if (order.dueDate instanceof Date) {
          dueDateValue = order.dueDate.toISOString();
        } else if (typeof order.dueDate === 'string') {
          dueDateValue = order.dueDate;
        } else {
          // Intentar convertir si es un formato válido
          try {
            dueDateValue = new Date(order.dueDate).toISOString();
          } catch {
            dueDateValue = null;
          }
        }
      }

      const orderData = {
        id: order.id,
        user_id: userId,
        provider_id: order.providerId,
        order_number: order.orderNumber,
        items: order.items || [],
        status: ORDER_STATUS.STANDBY,
        notes: order.notes || '',
        desired_delivery_date: desiredDeliveryDateValue,
        desired_delivery_time: Array.isArray(order.desiredDeliveryTime) && order.desiredDeliveryTime.length > 0
          ? order.desiredDeliveryTime
          : null,
        payment_method: order.paymentMethod || 'efectivo',
        due_date: dueDateValue, // ✅ AGREGADO: Fecha de vencimiento
        total_amount: order.totalAmount || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 [ServerOrderFlow] Datos a insertar:', {
        id: orderData.id,
        order_number: orderData.order_number,
        provider_id: orderData.provider_id,
        user_id: orderData.user_id,
        items_count: Array.isArray(orderData.items) ? orderData.items.length : 0,
        status: orderData.status
      });

      // Idempotente por id (evitar duplicados si hay doble disparo)
      const { data, error } = await this.supabase
        .from('orders')
        .upsert(orderData, { 
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [ServerOrderFlow] Error en upsert de Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return { success: false, errors: [error.message || 'Error desconocido creando orden'] };
      }

      if (!data) {
        console.error('❌ [ServerOrderFlow] Error: upsert no devolvió datos');
        return { success: false, errors: ['No se devolvieron datos después de crear la orden'] };
      }

      console.log('✅ [ServerOrderFlow] Orden creada exitosamente:', data.id);
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

      // 🔧 FIX: Incluir explícitamente auto_order_flow_enabled en el select
      const { data, error } = await this.supabase
        .from('providers')
        .select('id, name, phone, contact_name, user_id, auto_order_flow_enabled')
        .eq('id', providerId)
        .single();

      if (error) {
        console.error('❌ [ServerOrderFlow] Error obteniendo proveedor:', error);
        return { success: false, errors: [error.message] };
      }

      console.log('🔍 [ServerOrderFlow] Proveedor obtenido - auto_order_flow_enabled:', data?.auto_order_flow_enabled);
      
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

      // 🔧 Obtener nombre del proveedor para usar en el header del template
      const providerName = provider.name || 'Proveedor';
      const contactName = provider.contact_name || provider.name || 'Contacto';

      const templateVariables = {
        provider_name: providerName, // 🔧 CORRECCIÓN: Usar nombre del proveedor en el header
        contact_name: contactName
      };

      console.log('📤 [ServerOrderFlow] Variables del template:', templateVariables);

      // ✅ NO llamar a setupTemplatesForUser aquí porque puede recrear templates aprobados
      // Los templates ya deberían estar creados durante el setup inicial del usuario
      // Solo verificar que existan, no recrearlos
      // (Removido para evitar que Meta ponga templates aprobados en PENDING)

      // ✅ ENVIAR TEMPLATE evio_orden usando la API de Kapso
      // 🔧 CORRECCIÓN: Enviar provider_name primero (para header), luego contact_name (para body)
      const templateResult = await this.sendTemplateMessage(
        phone,
        'evio_orden',
        'es_ES', // ✅ CAMBIO: Español de España para coincidir con la definición del template
        [templateVariables.contact_name, templateVariables.provider_name], // contact_name para body, provider_name para header
        order.user_id
      );

      console.log('📤 [ServerOrderFlow] Resultado del envío de template:', templateResult);
      console.log('📤 [ServerOrderFlow] templateResult.success:', templateResult.success);
      console.log('📤 [ServerOrderFlow] templateResult.error:', templateResult.error);
      console.log('📤 [ServerOrderFlow] templateResult.code:', (templateResult as any).code);

      // ✅ FALLBACK: Si el template falla por cualquier razón, enviar mensaje de texto normal
      if (!templateResult.success) {
        console.log('⚠️ [ServerOrderFlow] Template falló, intentando fallback con texto normal...');
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

            // Construir mensaje de texto con el header del template y detalles de la orden
            // Header del template evio_orden: incluye provider_name (nombre del proveedor)
            const headerMessage = `${templateVariables.provider_name}\n\nBuen día ${templateVariables.contact_name}! Espero que andes bien!\nPreparé el pedido de esta semana. ¿Me confirmás cuando puedas para pasarte el detalle completo?`;
            const fullMessage = headerMessage;

            console.log('📝 [ServerOrderFlow] Enviando fallback de texto:', fullMessage.substring(0, 100) + '...');

            const textResult = await whatsappClient.messages.sendText({
              phoneNumberId,
              to: phone,
              body: fullMessage
            });

            console.log('✅ [ServerOrderFlow] Fallback de texto enviado exitosamente:', textResult.messages?.[0]?.id);
            await this.savePendingOrder(order, provider);
            return { 
              success: true, 
              fallbackSent: true, 
              pendingApproval: (templateResult as any).code === 131037 
            };
          } else {
            console.error('❌ [ServerOrderFlow] No se encontró phone_number_id para fallback');
            return { 
              success: false, 
              errors: [templateResult.error || 'Error enviando template y no se pudo enviar fallback'], 
              fallbackSent: false 
            };
          }
        } catch (fallbackError) {
          console.error('❌ [ServerOrderFlow] Error en fallback de texto:', fallbackError);
          return { 
            success: false, 
            errors: [
              templateResult.error || 'Error enviando template',
              `Error en fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Error desconocido'}`
            ], 
            fallbackSent: false 
          };
        }
      }

      // ✅ Template enviado exitosamente
      if (templateResult.success) {
        console.log('✅ [ServerOrderFlow] Template enviado exitosamente');
      }
      
      return { 
        success: !!templateResult.success, 
        pendingApproval: false, 
        errors: templateResult.success ? undefined : [templateResult.error || 'Error desconocido enviando template'] 
      };     

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error enviando notificación:', error);
      console.error('❌ [ServerOrderFlow] Stack trace:', error instanceof Error ? error.stack : 'N/A');
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Error enviando notificación'] 
      };
    }
  }

  /**
   * ✅ NUEVO: Enviar detalles de la orden inmediatamente después del template (sin esperar respuesta)
   */
  private async sendOrderDetailsImmediately(phone: string, order: any, provider: any): Promise<void> {
    try {
      console.log('📋 [ServerOrderFlow] Enviando detalles de la orden inmediatamente:', {
        orderId: order.id,
        orderNumber: order.order_number,
        phone: phone
      });

      // Usar el formato de mensaje de ORDER_FLOW_CONFIG
      const { ORDER_FLOW_CONFIG } = await import('./orderFlowConfig');
      const message = ORDER_FLOW_CONFIG.MESSAGES.send_order_details(order, provider);
      
      console.log('📝 [ServerOrderFlow] Mensaje de detalles a enviar:', message);

      // Enviar mensaje usando WhatsAppClient de Kapso
      const { WhatsAppClient } = await import('@kapso/whatsapp-cloud-api');
      
      // Obtener phone_number_id del usuario
      const { data: config } = await this.supabase
        .from('user_whatsapp_config')
        .select('phone_number_id')
        .eq('user_id', order.user_id)
        .eq('is_active', true)
        .single();

      if (!config?.phone_number_id) {
        console.error('❌ [ServerOrderFlow] No se encontró phone_number_id para enviar detalles');
        return;
      }

      const whatsappClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: process.env.KAPSO_API_KEY!,
        graphVersion: 'v24.0'
      });

      const result = await whatsappClient.messages.sendText({
        phoneNumberId: config.phone_number_id,
        to: phone,
        body: message
      });

      console.log('✅ [ServerOrderFlow] Detalles de la orden enviados exitosamente:', result.messages?.[0]?.id);

    } catch (error) {
      console.error('❌ [ServerOrderFlow] Error enviando detalles inmediatamente:', error);
      throw error; // Re-lanzar para que el caller pueda manejarlo
    }
  }

  /**
   * Enviar template de WhatsApp usando la API de Kapso
   */
  async sendTemplateMessage(
    phone: string, 
    templateName: string, 
    languageCode: string,
    parameters: string[],
    userId: string
  ): Promise<{ success: boolean; error?: string; code?: number }> {
    try {
      console.log('📤 [ServerOrderFlow] Enviando template:', { phone, templateName, languageCode, parameters });

      // ✅ Obtener configuración del usuario (incluyendo waba_id si está guardado)
      const { data: config } = await this.supabase
        .from('user_whatsapp_config')
        .select('phone_number_id, kapso_config_id, waba_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!config?.phone_number_id) {
        throw new Error('No se encontró configuración de WhatsApp para el usuario');
      }

      const phoneNumberId = config.phone_number_id;

      // ✅ PRIORIDAD 1: Usar WABA_ID guardado en Supabase (si existe)
      let businessAccountId: string | undefined = config.waba_id;
      
      if (businessAccountId) {
        console.log('✅ [ServerOrderFlow] WABA_ID obtenido desde Supabase:', businessAccountId);
      } else {
        // ✅ PRIORIDAD 2: Obtener desde Kapso Platform API y guardarlo
        if (config.kapso_config_id) {
          try {
            const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';
            const kapsoApiKey = process.env.KAPSO_API_KEY;
            
            if (kapsoApiKey) {
              console.log(`🔍 [ServerOrderFlow] Obteniendo WABA_ID desde Kapso Platform para config ${config.kapso_config_id}`);
              const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${config.kapso_config_id}`, {
                headers: {
                  'X-API-Key': kapsoApiKey,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
              const details = await response.json();
              const data = details?.data ?? details;
              // ✅ CORRECCIÓN: Buscar también business_account_id (que es lo que devuelve Kapso)
              const wabaFromKapso = data?.meta_business_account_id || data?.meta_whatsapp_business_account_id || data?.waba_id || data?.business_account_id;
                if (wabaFromKapso) {
                  businessAccountId = wabaFromKapso;
                  console.log('✅ [ServerOrderFlow] WABA_ID obtenido desde Kapso Platform:', businessAccountId);
                  
                  // ✅ Guardar WABA_ID en Supabase para futuras consultas
                  try {
                    const { error: updateError } = await this.supabase
                      .from('user_whatsapp_config')
                      .update({ waba_id: businessAccountId })
                      .eq('user_id', userId)
                      .eq('is_active', true);
                    
                    if (updateError) {
                      console.warn('⚠️ [ServerOrderFlow] No se pudo guardar WABA_ID en Supabase:', updateError);
                    } else {
                      console.log('✅ [ServerOrderFlow] WABA_ID guardado en Supabase para futuras consultas');
                    }
                  } catch (saveError) {
                    console.warn('⚠️ [ServerOrderFlow] Error guardando WABA_ID:', saveError);
                  }
                }
              } else {
                const errorText = await response.text();
                console.warn(`⚠️ [ServerOrderFlow] Error obteniendo WABA_ID desde Kapso Platform: ${response.status} - ${errorText}`);
              }
            }
          } catch (error) {
            console.warn('⚠️ [ServerOrderFlow] No se pudo obtener WABA_ID desde Kapso Platform:', error);
          }
        }
        
        // ✅ PRIORIDAD 3: Intentar obtener desde phone_number_id vía Kapso proxy
        if (!businessAccountId && phoneNumberId) {
          try {
            const kapsoApiKey = process.env.KAPSO_API_KEY;
            if (kapsoApiKey) {
              console.log(`🔍 [ServerOrderFlow] Intentando obtener WABA_ID desde Kapso proxy para phone_number_id ${phoneNumberId}`);
              const response = await fetch(`https://api.kapso.ai/meta/whatsapp/v17.0/${phoneNumberId}?fields=whatsapp_business_account`, {
                headers: {
                  'X-API-Key': kapsoApiKey,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                const data = await response.json();
                const wabaFromProxy = data?.whatsapp_business_account?.id || data?.data?.whatsapp_business_account?.id;
                if (wabaFromProxy) {
                  businessAccountId = wabaFromProxy;
                  console.log('✅ [ServerOrderFlow] WABA_ID obtenido desde Kapso proxy:', businessAccountId);
                  
                  // ✅ Guardar WABA_ID en Supabase
                  try {
                    await this.supabase
                      .from('user_whatsapp_config')
                      .update({ waba_id: businessAccountId })
                      .eq('user_id', userId)
                      .eq('is_active', true);
                    console.log('✅ [ServerOrderFlow] WABA_ID guardado en Supabase');
                  } catch (saveError) {
                    console.warn('⚠️ [ServerOrderFlow] Error guardando WABA_ID:', saveError);
                  }
                }
              }
            }
          } catch (error) {
            console.warn('⚠️ [ServerOrderFlow] No se pudo obtener WABA_ID desde proxy:', error);
          }
        }
        
        // ✅ PRIORIDAD 4: Fallback a variables de entorno (solo si no se encontró)
        if (!businessAccountId) {
          businessAccountId = process.env.WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
          if (businessAccountId) {
            console.warn('⚠️ [ServerOrderFlow] Usando WABA_ID de entorno (no recomendado para producción):', businessAccountId);
          } else {
            console.warn('⚠️ [ServerOrderFlow] No se pudo obtener WABA_ID, el envío puede fallar');
          }
        }
      }

      // Usar WhatsAppClient de Kapso SDK para enviar template
      const { WhatsAppClient, buildTemplateSendPayload } = await import('@kapso/whatsapp-cloud-api');
      const whatsappClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: process.env.KAPSO_API_KEY!,
        graphVersion: 'v24.0'
      });

      // ✅ Verificar que el template existe antes de intentar enviarlo
      if (!businessAccountId) {
        console.error('❌ [ServerOrderFlow] No se pudo obtener WABA_ID, no se puede verificar si el template existe');
        return {
          success: false,
          error: 'No se pudo obtener WABA_ID del usuario',
          code: undefined
        };
      }

      // Ajustar parámetros al número esperado (consultar definición del template)
      try {
        if (businessAccountId) {
          console.log(`🔍 [ServerOrderFlow] Verificando templates en WABA_ID: ${businessAccountId}`);
          const tplResp = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates?limit=100`, {
            headers: { 'X-API-Key': process.env.KAPSO_API_KEY as string }
          });
          
          if (!tplResp.ok) {
            const errorText = await tplResp.text();
            console.error(`❌ [ServerOrderFlow] Error obteniendo templates: ${tplResp.status} - ${errorText}`);
            throw new Error(`Error obteniendo templates: ${tplResp.status}`);
          }
          
          const tplData = await tplResp.json();
          const all = (tplData?.data || tplData?.message_templates || []) as any[];
          
          console.log(`📋 [ServerOrderFlow] Templates encontrados en WABA ${businessAccountId}: ${all.length}`);
          console.log(`📋 [ServerOrderFlow] Nombres de templates: ${all.map((t: any) => `${t.name} (${t.language || t.languages?.join(', ') || 'N/A'})`).join(', ')}`);
          
          // ✅ MEJORA: Buscar primero en el idioma solicitado, luego en cualquier idioma
          let match = all.find((t: any) => {
            const nameMatch = t?.name === templateName;
            const langMatch = t?.language === languageCode || t?.languages?.includes?.(languageCode);
            return nameMatch && langMatch;
          });
          
          // ✅ FALLBACK: Si no se encuentra en el idioma solicitado, buscar en cualquier idioma
          if (!match) {
            console.warn(`⚠️ [ServerOrderFlow] Template ${templateName} no encontrado en ${languageCode}, buscando en otros idiomas...`);
            match = all.find((t: any) => t?.name === templateName);
            
            if (match) {
              const foundLanguage = match.language || (match.languages && match.languages[0]) || 'desconocido';
              console.log(`✅ [ServerOrderFlow] Template ${templateName} encontrado en idioma ${foundLanguage} (se usará este idioma en lugar de ${languageCode})`);
              // ✅ ACTUALIZAR languageCode para usar el idioma encontrado
              languageCode = foundLanguage;
            }
          }
          
          if (!match) {
            console.error(`❌ [ServerOrderFlow] Template ${templateName} no existe en ningún idioma para WABA ${businessAccountId}`);
            console.error(`❌ [ServerOrderFlow] Templates disponibles en este WABA:`, all.map((t: any) => `${t.name} (${t.language || t.languages?.join(', ') || 'N/A'})`).join(', '));
            return {
              success: false,
              error: `Template ${templateName} no existe para este usuario. Verifica que el template esté creado y aprobado en Meta Business Manager.`,
              code: 132001
            };
          }
          
          console.log(`✅ [ServerOrderFlow] Template ${templateName} encontrado en WABA ${businessAccountId} con status: ${match.status}`);
          console.log('🔍 [ServerOrderFlow] Template match from Kapso:', {
            name: match.name,
            language: match.language || match.languages,
            status: match.status,
            parameter_format: match.parameter_format,
            components_count: match?.components?.length || 0
          });
          
          // ✅ Verificar que el template esté aprobado o pendiente (PENDING puede ser válido si está en proceso de aprobación)
          const statusUpper = match.status?.toUpperCase();
          if (statusUpper && statusUpper !== 'APPROVED' && statusUpper !== 'PENDING') {
            console.warn(`⚠️ [ServerOrderFlow] Template ${templateName} no está aprobado ni pendiente. Status: ${match.status}`);
            return {
              success: false,
              error: `Template ${templateName} no está aprobado. Status actual: ${match.status}. Debe estar en estado APPROVED o PENDING para poder enviarlo.`,
              code: 132001
            };
          }
          
          // ⚠️ Advertencia si está PENDING pero permitir el envío
          if (statusUpper === 'PENDING') {
            console.warn(`⚠️ [ServerOrderFlow] Template ${templateName} está en estado PENDING. Intentando enviar de todas formas...`);
          }

          if (match?.components) {
            const comps: any[] = match.components;
            const isNamed = match.parameter_format === 'NAMED';

            const headerComp = comps.find(c => c.type === 'HEADER' && (!c.format || c.format === 'TEXT'));                                                    
            const bodyComp = comps.find(c => c.type === 'BODY');
            
            console.log('🔍 [ServerOrderFlow] Header component found:', !!headerComp);
            console.log('🔍 [ServerOrderFlow] Body component found:', !!bodyComp);
            if (headerComp) {
              console.log('🔍 [ServerOrderFlow] Header text:', headerComp.text);
            }
            if (bodyComp) {
              console.log('🔍 [ServerOrderFlow] Body text:', bodyComp.text);
              console.log('🔍 [ServerOrderFlow] Body placeholders:', typeof bodyComp?.text === 'string' ? (bodyComp.text.match(/\{\{\d+\}\}/g) || []).length : 0);
            }

            // Reconstruir options según definición
            const templateOptionsDyn: any = { name: templateName, language: languageCode };

            if (isNamed) {
              console.log('🔍 [ServerOrderFlow] Template usa parámetros NAMED');
              // Templates con parámetros NAMED: mapear por nombre
              if (headerComp) {
                let paramName: string | undefined;
                
                // Intentar obtener el nombre del ejemplo
                const headerExample = headerComp.example?.header_text_named_params?.[0];
                if (headerExample?.param_name) {
                  paramName = headerExample.param_name;
                  console.log('🔍 [ServerOrderFlow] Header param_name desde ejemplo:', paramName);
                } else {
                  // Extraer nombre del parámetro del texto del template usando regex
                  // Buscar {{nombre_parametro}} en el texto
                  const textMatch = headerComp.text?.match(/\{\{(\w+)\}\}/);
                  if (textMatch && textMatch[1]) {
                    paramName = textMatch[1];
                    console.log('🔍 [ServerOrderFlow] Header param_name extraído del texto:', paramName);
                  } else {
                    // Usar nombre por defecto si no podemos extraerlo
                    paramName = 'provider_name'; // 🔧 CORRECCIÓN: Usar provider_name como valor por defecto (nombre del proveedor)
                    console.log('🔍 [ServerOrderFlow] Header usando param_name por defecto:', paramName);
                  }
                }
                
                if (paramName) {
                  // 🔧 CORRECCIÓN: Para header con provider_name, usar parameters[1] (segundo parámetro)
                  // parameters = [contact_name, provider_name]
                  let value: string | undefined;
                  if (paramName === 'provider_name' || paramName === 'company_name') {
                    // Soporta tanto provider_name como company_name por compatibilidad
                    // provider_name es el nombre del proveedor (correcto)
                    value = parameters.length > 1 ? parameters[1] : (parameters.length > 0 ? parameters[0] : undefined);
                  } else {
                    value = parameters.length > 0 ? parameters[0] : undefined;
                  }
                  
                  if (value) {
                    templateOptionsDyn.header = {
                      type: 'text',
                      parameter_name: paramName,
                      text: value
                    };
                    console.log('✅ [ServerOrderFlow] Header parameter construido:', { parameter_name: paramName, text: value, usedParameterIndex: (paramName === 'company_name' || paramName === 'provider_name') ? 1 : 0 });                            
                  } else {
                    console.warn('⚠️ [ServerOrderFlow] Header parameter value es undefined o vacío');
                  }
                }
              }
              
              if (bodyComp) {
                let paramName: string | undefined;
                
                // Intentar obtener el nombre del ejemplo
                const bodyExample = bodyComp.example?.body_text_named_params?.[0];
                if (bodyExample?.param_name) {
                  paramName = bodyExample.param_name;
                  console.log('🔍 [ServerOrderFlow] Body param_name desde ejemplo:', paramName);
                } else {
                  // Extraer nombre del parámetro del texto del template usando regex
                  // Buscar {{nombre_parametro}} en el texto
                  const textMatch = bodyComp.text?.match(/\{\{(\w+)\}\}/);
                  if (textMatch && textMatch[1]) {
                    paramName = textMatch[1];
                    console.log('🔍 [ServerOrderFlow] Body param_name extraído del texto:', paramName);
                  } else {
                    // Usar nombre por defecto basado en la posición
                    paramName = 'contact_name';
                    console.log('🔍 [ServerOrderFlow] Body usando param_name por defecto:', paramName);
                  }
                }
                
                if (paramName) {
                  // Para templates NAMED con un solo parámetro en body, usar el primer parámetro
                  const value = parameters[0];
                  if (value) {
                    templateOptionsDyn.body = [{ 
                      type: 'text', 
                      parameter_name: paramName, 
                      text: value 
                    }];
                    console.log('✅ [ServerOrderFlow] Body parameter construido:', { parameter_name: paramName, text: value });
                  }
                }
              }
            } else {
              // Templates con parámetros NUMERIC: mapear por posición
              const pick = (idx: number): string => parameters[idx] ?? parameters[parameters.length - 1] ?? '';
              const headerPlaceholders = typeof headerComp?.text === 'string' ? (headerComp.text.match(/\{\{\d+\}\}/g) || []).length : 0;
              const bodyPlaceholders = typeof bodyComp?.text === 'string' ? (bodyComp.text.match(/\{\{\d+\}\}/g) || []).length : 0;

              if (headerPlaceholders > 0) {
                templateOptionsDyn.header = { type: 'text', text: pick(0) };
              }
              if (bodyPlaceholders > 0) {
                const bodyParams = Array.from({ length: bodyPlaceholders }, (_, i) => {
                  const txt = pick(headerPlaceholders + i);
                  if (!txt) {
                    throw new Error(`Empty parameter at index ${headerPlaceholders + i}, parameters=${JSON.stringify(parameters)}`);
                  }
                  return { type: 'text', text: txt };
                });
                templateOptionsDyn.body = bodyParams;
              }
            }

            // Construir payload manualmente para evitar problemas con buildTemplateSendPayload
            const manualPayload = {
              name: templateName,
              language: { code: languageCode },
              components: [] as any[]
            };
            
            if (templateOptionsDyn.header) {
              // 🔧 FIX: Asegurar que el header tenga parámetros válidos
              console.log('🔍 [ServerOrderFlow] Verificando header antes de agregar:', {
                hasText: !!templateOptionsDyn.header.text,
                hasParameterName: !!templateOptionsDyn.header.parameter_name,
                text: templateOptionsDyn.header.text,
                parameter_name: templateOptionsDyn.header.parameter_name,
                headerObject: JSON.stringify(templateOptionsDyn.header)
              });
              
              if (templateOptionsDyn.header.text && templateOptionsDyn.header.parameter_name) {
                const headerComponent = {
                  type: 'header',
                  parameters: [{
                    type: 'text',
                    parameter_name: templateOptionsDyn.header.parameter_name,
                    text: templateOptionsDyn.header.text
                  }]
                };
                manualPayload.components.push(headerComponent);
                console.log('✅ [ServerOrderFlow] Header component agregado al payload:', JSON.stringify(headerComponent, null, 2));
              } else {
                console.warn('⚠️ [ServerOrderFlow] Header no tiene text o parameter_name, omitiendo header component');
                console.warn('⚠️ [ServerOrderFlow] Header object:', JSON.stringify(templateOptionsDyn.header, null, 2));
              }
            } else {
              console.warn('⚠️ [ServerOrderFlow] templateOptionsDyn.header no está definido');
              console.warn('⚠️ [ServerOrderFlow] templateOptionsDyn completo:', JSON.stringify(templateOptionsDyn, null, 2));
            }
            
            if (templateOptionsDyn.body) {
              manualPayload.components.push({
                type: 'body',
                parameters: templateOptionsDyn.body
              });
            }
            
            console.log('🔍 [ServerOrderFlow] Template payload manual:', JSON.stringify(manualPayload, null, 2));
            try {
              const resultDyn = await whatsappClient.messages.sendTemplate({ phoneNumberId, to: phone, template: manualPayload });
              console.log('✅ [ServerOrderFlow] Template enviado (definición dinámica):', resultDyn.messages?.[0]?.id);
              return { success: true };
            } catch (sendError: any) {
              console.error('❌ [ServerOrderFlow] Error al enviar payload manual:', sendError);
              throw sendError; // Re-lanzar para que sea capturado por el catch externo
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ [ServerOrderFlow] Error en envío dinámico:', e);  
        console.warn('⚠️ [ServerOrderFlow] Usando fallback con buildTemplateSendPayload');
      }

      // 🔧 FIX: Construir payload del template usando buildTemplateSendPayload
      // PERO si el template es NAMED, necesitamos incluir parameter_name
      const templateOptions: any = {
        name: templateName,
        language: languageCode
      };

      // 🔧 FIX: Para evio_orden, asumir que es NAMED y usar contact_name como parameter_name
      // Si el template usa parámetros NAMED, cada parámetro debe incluir parameter_name
      if (parameters && parameters.length > 0) {
        // Para templates NAMED como evio_orden, el primer parámetro generalmente es contact_name
        templateOptions.body = parameters.map((param, index) => {
          // Para evio_orden específicamente, el body usa contact_name
          if (templateName === 'evio_orden' && index === 0) {
            return {
              type: 'text',
              parameter_name: 'contact_name', // 🔧 FIX: Incluir parameter_name para templates NAMED
              text: param
            };
          }
          // Fallback para otros templates
          return {
            type: 'text',
            text: param
          };
        });
      }

      console.log('📋 [ServerOrderFlow] Fallback templateOptions:', JSON.stringify(templateOptions, null, 2));

      // 🔧 FIX: Si el template es evio_orden (NAMED), construir payload manualmente
      // porque buildTemplateSendPayload podría no respetar parameter_name
      let templatePayload;
      if (templateName === 'evio_orden' && parameters && parameters.length > 0) {
        // Construir payload manualmente para templates NAMED
        const components: any[] = [];
        
        // Agregar header con company_name si hay 2 parámetros
        if (parameters.length > 1 && parameters[1]) {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'text',
                parameter_name: 'company_name', // 🔧 CAMBIO: Usar company_name en lugar de provider_name
                text: parameters[1]
              }
            ]
          });
        }
        
        // Agregar body con contact_name
        components.push({
          type: 'body',
          parameters: [
            {
              type: 'text',
              parameter_name: 'contact_name',
              text: parameters[0]
            }
          ]
        });
        
        templatePayload = {
          name: templateName,
          language: { code: languageCode },
          components
        };
        console.log('📋 [ServerOrderFlow] Fallback payload manual (NAMED):', JSON.stringify(templatePayload, null, 2));
      } else {
        // Usar buildTemplateSendPayload para otros templates
        templatePayload = buildTemplateSendPayload(templateOptions);
        console.log('📋 [ServerOrderFlow] Fallback templatePayload (buildTemplateSendPayload):', JSON.stringify(templatePayload, null, 2));
      }

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

  private async savePendingOrder(order: any, provider: any): Promise<void> {
    try {
      if (!this.supabase) return;

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(provider.phone || '');
      const providerPhone = normalizedPhone || provider.phone;

      const pendingRecord: any = {
        order_id: order.id,
        provider_id: provider.id,
        user_id: order.user_id,
        provider_phone: providerPhone,
        order_data: JSON.stringify({
          id: order.id,
          orderNumber: order.order_number,
          items: order.items,
          totalAmount: order.total_amount,
          status: order.status,
          providerId: order.provider_id,
          userId: order.user_id,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        }),
        status: 'pending_confirmation',
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('pending_orders')
        .upsert(pendingRecord, { onConflict: 'order_id' });

      if (error) {
        console.error('⚠️ [ServerOrderFlow] Error guardando pending_order:', error);
      } else {
        console.log('✅ [ServerOrderFlow] pending_order guardado para orden:', order.id);
      }
    } catch (error) {
      console.error('⚠️ [ServerOrderFlow] Error interno guardando pending_order:', error);
    }
  }
}

export const serverOrderFlowService = ServerOrderFlowService.getInstance();
