/**
 * 🚀 SERVICIO DE FLUJO DE ÓRDENES EXTENSIBLE
 * Usa configuración para permitir modificaciones fáciles del flujo
 */

// Importar cliente de Supabase del servidor para usar en el webhook
import { metaWhatsAppService } from './metaWhatsAppService';
import { PhoneNumberService } from './phoneNumberService';
import { ORDER_FLOW_CONFIG, getNextTransition, isValidTransition, getActionMessage } from './orderFlowConfig';
import { ORDER_STATUS } from './orderConstants';
// Importación dinámica de KapsoService para evitar problemas de compilación

export interface FlowResult {
  success: boolean;
  message?: string;
  orderId?: string;
  newStatus?: string;
  errors?: string[];
}

export class ExtensibleOrderFlowService {
  private static instance: ExtensibleOrderFlowService;
  private processingActions: Set<string> = new Set(); // Trackear acciones en progreso

  static getInstance(): ExtensibleOrderFlowService {
    if (!ExtensibleOrderFlowService.instance) {
      ExtensibleOrderFlowService.instance = new ExtensibleOrderFlowService();
    }
    return ExtensibleOrderFlowService.instance;
  }

  /**
   * 📤 Enviar mensaje por Kapso (método público)
   */
  async sendMessage(phone: string, message: string, userId?: string): Promise<any> {
    try {
      console.log('📤 [ExtensibleOrderFlow] Enviando mensaje por Kapso:', { phone, message, userId });
      await this.sendMessageToKapso(phone, message, userId);
      return { success: true };
    } catch (error) {
      console.error('❌ [ExtensibleOrderFlow] Error enviando mensaje:', error);
      return { success: false, error };
    }
  }

  /**
   * 🔄 Procesar mensaje del proveedor (automático basado en configuración)
   */
  async processProviderMessage(phone: string, message: string, userId?: string): Promise<FlowResult> {
    try {
      console.log('🚀 [ExtensibleOrderFlow] Iniciando processProviderMessage:', {
        phone,
        message,
        userId
      });

      // Crear cliente de Supabase del servidor
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const normalizedPhone = PhoneNumberService.normalizePhoneNumber(phone);
      console.log('📞 [ExtensibleOrderFlow] Teléfono normalizado:', normalizedPhone);
      
      if (!normalizedPhone) {
        console.log('❌ [ExtensibleOrderFlow] Número de teléfono inválido');
        return { success: false, errors: ['Número de teléfono inválido'] };
      }

      // Buscar órdenes por usuario
      console.log('🔍 [ExtensibleOrderFlow] Buscando órdenes para userId:', userId);
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !orders) {
        console.log('❌ [ExtensibleOrderFlow] Error buscando órdenes:', error);
        return { success: false, errors: ['Error buscando órdenes'] };
      }

      console.log('📋 [ExtensibleOrderFlow] Órdenes encontradas:', orders.length);

      // Filtrar por teléfono del proveedor y encontrar la más reciente
      let foundOrder = null;
      let matchingOrders = [];
      
      for (const order of orders) {
        const { data: provider } = await supabase
          .from('providers')
          .select('phone')
          .eq('id', order.provider_id)
          .single();
        
        console.log('🔍 [ExtensibleOrderFlow] Verificando orden:', {
          orderId: order.id,
          orderStatus: order.status,
          providerPhone: provider?.phone,
          normalizedPhone: normalizedPhone,
          match: provider?.phone === normalizedPhone
        });
        
        if (provider?.phone === normalizedPhone) {
          matchingOrders.push(order);
        }
      }
      
      // 🔧 MEJORA: Tomar la orden más reciente que pueda procesar
      if (matchingOrders.length > 0) {
        // Filtrar órdenes que pueden procesar (no pagado ni finalizado)
        const processableOrders = matchingOrders.filter(order => 
          order.status !== 'pagado' && order.status !== 'completed' && order.status !== 'finalizado'
        );
        
        if (processableOrders.length > 0) {
          // Ordenar por fecha de actualización descendente y tomar la más reciente
          processableOrders.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
          foundOrder = processableOrders[0];
          
          console.log('✅ [ExtensibleOrderFlow] Orden procesable más reciente encontrada:', {
            id: foundOrder.id,
            status: foundOrder.status,
            orderNumber: foundOrder.order_number,
            totalMatching: matchingOrders.length,
            processableCount: processableOrders.length
          });
        } else {
          // Si no hay órdenes procesables, tomar la más reciente
          matchingOrders.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
          foundOrder = matchingOrders[0];
          
          console.log('⚠️ [ExtensibleOrderFlow] No hay órdenes procesables, tomando la más reciente:', {
            id: foundOrder.id,
            status: foundOrder.status,
            orderNumber: foundOrder.order_number
          });
        }
      }

      if (!foundOrder) {
        console.log('⚠️ [ExtensibleOrderFlow] No se encontró orden para este proveedor');
        return { success: false, message: 'No se encontró orden para este proveedor' };
      }


      // 🔧 CORRECCIÓN: Validar si el mensaje actual debe activar una transición
      console.log('🔍 [ExtensibleOrderFlow] Validando si el mensaje debe activar transición:', {
        currentStatus: foundOrder.status,
        messageType: 'text',
        messageContent: message
      });

      // 🔧 NUEVA LÓGICA: Solo procesar transiciones específicas según el estado
      if (foundOrder.status === 'enviado') {
        // En estado 'enviado', solo los documentos (facturas) deben activar la transición
        if (message === 'documento_recibido') {
          console.log('✅ [ExtensibleOrderFlow] Documento recibido, procesando transición de enviado → pendiente_de_pago');
          
          // Obtener la transición configurada
          const transition = getNextTransition(foundOrder.status);
          if (!transition) {
            console.log('⚠️ [ExtensibleOrderFlow] No hay transición configurada para enviado → pendiente_de_pago');
            return { success: false, message: 'No hay transición configurada' };
          }

          // Ejecutar la transición automática
          return await this.executeTransition(foundOrder, transition, normalizedPhone, message);
        } else {
          console.log('⚠️ [ExtensibleOrderFlow] Estado "enviado" requiere documento (factura) para continuar');
          return { success: false, message: 'Se requiere una factura válida para continuar el flujo' };
        }
      } else if (foundOrder.status === 'pendiente_de_pago') {
        // ✅ CORREGIDO: En estado 'pendiente_de_pago', NO debe completarse automáticamente
        // La orden solo debe completarse cuando el usuario suba un comprobante de pago real
        console.log('⚠️ [ExtensibleOrderFlow] Estado "pendiente_de_pago" - La orden solo se completa cuando el usuario sube un comprobante de pago real');
        console.log('ℹ️ [ExtensibleOrderFlow] El mensaje "documento_recibido" no debe activar la transición automática');
        return { 
          success: false, 
          message: 'La orden está pendiente de pago. Solo se completará cuando se suba un comprobante de pago real.' 
        };
      } else if (foundOrder.status === 'standby') {
        // 🔧 AUTOMÁTICO: En estado 'standby', cualquier respuesta del proveedor activa la transición
        console.log('✅ [ExtensibleOrderFlow] Respuesta del proveedor recibida, activando transición automática standby → enviado');
        
        // Obtener la transición configurada
        const transition = getNextTransition(foundOrder.status);
        if (!transition) {
          console.log('⚠️ [ExtensibleOrderFlow] No hay transición configurada para standby → enviado');
          return { success: false, message: 'No hay transición configurada' };
        }

        // Ejecutar la transición automática
        return await this.executeTransition(foundOrder, transition, normalizedPhone, message);
      }

      // 🔧 CORRECCIÓN: Si llegamos aquí, significa que no hay transición válida
      // No procesar ninguna transición automática
      console.log('⚠️ [ExtensibleOrderFlow] No hay transición válida para procesar');
      return { success: false, message: 'No hay transición disponible para este estado' };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }

  /**
   * 🔄 Ejecutar transición del flujo
   */
  private async executeTransition(order: any, transition: any, phone: string, message: string): Promise<FlowResult> {
    try {
      // Crear cliente de Supabase del servidor
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // 1. Actualizar estado de la orden
      console.log(`🔄 [ExtensibleFlow] Actualizando orden ${order.id} de '${order.status}' a '${transition.next}'`);
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: transition.next,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        console.error(`❌ [ExtensibleFlow] Error actualizando estado:`, updateError);
        return { success: false, errors: ['Error actualizando estado'] };
      }

      console.log(`✅ [ExtensibleFlow] Orden ${order.id} actualizada exitosamente a '${transition.next}'`);
      console.log('🔔 [ExtensibleFlow] Esta actualización debería disparar un evento Realtime para los suscriptores');
      
      // 🔧 WORKAROUND: Emitir broadcast manual para notificar a los clientes Realtime
      try {
        const broadcastResult = await supabase
          .channel('orders-updates')
          .send({
            type: 'broadcast' as const,
            event: 'order_updated',
            payload: {
              orderId: order.id,
              status: transition.next,
              timestamp: new Date().toISOString(),
              source: 'order_flow_transition'
            }
          });

        if (broadcastResult === 'error') {
          console.error('⚠️ [ExtensibleFlow] Error enviando broadcast');
        } else {
          console.log('✅ [ExtensibleFlow] Broadcast de actualización enviado');
        }
      } catch (broadcastErr) {
        console.error('⚠️ [ExtensibleFlow] Error en broadcast:', broadcastErr);
      }

      // 2. Ejecutar acción asociada
      if (transition.action) {
        await this.executeAction(transition.action, order, phone);
      }

      return {
        success: true,
        orderId: order.id,
        newStatus: transition.next,
        message: `Orden actualizada a ${transition.next}`
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Error ejecutando transición']
      };
    }
  }

  /**
   * 🎯 Ejecutar acción específica
   */
  private async executeAction(action: string, order: any, phone: string): Promise<void> {
    // ✅ PROTECCIÓN CONTRA DUPLICACIÓN: Crear clave única para esta acción
    const actionKey = `${action}_${order.id}_${phone}`;
    
    if (this.processingActions.has(actionKey)) {
      console.log(`🔄 [ExtensibleOrderFlow] Acción ${action} ya en progreso para orden ${order.id}, ignorando...`);
      return;
    }
    
    this.processingActions.add(actionKey);
    
    try {
      console.log('🎯 [ExtensibleOrderFlow] Ejecutando acción:', {
        action: action,
        orderId: order.id,
        orderNumber: order.order_number,
        phone: phone
      });

      switch (action) {
        case 'send_order_details':
          console.log('📋 [ExtensibleOrderFlow] Ejecutando send_order_details...');
          await this.sendOrderDetails(order, phone);
          break;
        case 'send_invoice_request':
          console.log('📄 [ExtensibleOrderFlow] Ejecutando send_invoice_request...');
          await this.sendInvoiceRequest(order, phone);
          break;
        case 'process_invoice':
          console.log('🧾 [ExtensibleOrderFlow] Ejecutando process_invoice...');
          await this.processInvoice(order, phone);
          break;
        case 'complete_order':
          console.log('✅ [ExtensibleOrderFlow] Ejecutando complete_order...');
          await this.completeOrder(order, phone);
          break;
        default:
          console.log('⚠️ [ExtensibleOrderFlow] Acción no reconocida:', action);
      }

      console.log('✅ [ExtensibleOrderFlow] Acción ejecutada exitosamente:', action);
    } catch (error) {
      console.error('❌ [ExtensibleOrderFlow] Error ejecutando acción:', action, error);
    } finally {
      // Limpiar la clave después de un delay para permitir futuras ejecuciones
      setTimeout(() => {
        this.processingActions.delete(actionKey);
      }, 10000); // 10 segundos
    }
  }

  /**
   * ✅ FUNCIÓN AUXILIAR: Enviar mensaje por ambos canales (Meta + Kapso)
   */
  private async sendMessageToKapso(phone: string, message: string, userId?: string): Promise<void> {
    try {
      // Verificar que estamos en el servidor y que la API key está disponible
      if (typeof window !== 'undefined' || !process.env.KAPSO_API_KEY) {
        console.log('⚠️ [ExtensibleOrderFlow] Saltando envío a Kapso (lado cliente o API key faltante)');
        return;
      }
      
      console.log('📤 [ExtensibleOrderFlow] Enviando mensaje solo por Kapso:', { phone, message });
      
      // ✅ MEJORA: Usar la API de Kapso directamente para mejor confiabilidad
      const kapsoTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout Kapso')), 5000); // 5 segundos máximo
      });
      
      const kapsoOperation = (async () => {
        // Importar dinámicamente para evitar problemas de compilación
        const { KapsoService: KapsoServiceClass } = await import('./kapsoService');
        const kapsoService = new KapsoServiceClass();
        
        // Buscar conversación existente o enviar mensaje standalone
        const conversations = await kapsoService.getAllActiveConversations();
        const existingConversation = conversations.find(conv => 
          PhoneNumberService.normalizePhoneNumber(conv.phone_number) === PhoneNumberService.normalizePhoneNumber(phone)
        );

        let result;
        if (existingConversation) {
          result = await kapsoService.sendMessage(existingConversation.id, {
            type: 'text',
            content: message
          }, userId);
          console.log('📤 [ExtensibleOrderFlow] Mensaje enviado a Kapso (conversación existente):', result?.data?.id);
        } else {
          result = await kapsoService.sendStandaloneMessage(phone, {
            type: 'text',
            content: message
          }, userId);
          console.log('📤 [ExtensibleOrderFlow] Mensaje enviado a Kapso (standalone):', result?.data?.id);
        }
        
        // ✅ CORRECCIÓN: Notificar al frontend que se envió un mensaje
        if (result?.data?.id) {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            
            console.log('📡 [ExtensibleOrderFlow] Enviando broadcast al frontend...');
            const { error: broadcastError } = await supabase
              .channel('kapso_messages')
              .send({
                type: 'broadcast',
                event: 'new_message',
                payload: {
                  messageId: result.data.id,
                  fromNumber: '5491141780300', // Número de la empresa
                  content: message,
                  messageType: 'text',
                  timestamp: new Date().toISOString(),
                  userId: userId || 'b5a237e6-c9f9-4561-af07-a1408825ab50'
                }
              });
            
            console.log('📡 [ExtensibleOrderFlow] Broadcast enviado, error:', broadcastError);
            
            if (broadcastError) {
              console.error('❌ [ExtensibleOrderFlow] Error notificando mensaje al frontend:', broadcastError);
            } else {
              console.log('✅ [ExtensibleOrderFlow] Mensaje notificado al frontend:', result.data.id);
            }
          } catch (notificationError) {
            console.error('❌ [ExtensibleOrderFlow] Error enviando notificación:', notificationError);
          }
        }
        
        return result;
      })();
      
      // Ejecutar con timeout
      await Promise.race([kapsoOperation, kapsoTimeout]);
    } catch (kapsoError) {
      console.error('❌ [ExtensibleOrderFlow] Error enviando a Kapso:', kapsoError);
      throw kapsoError; // Lanzar error para que se maneje apropiadamente
    }
  }

  /**
   * 📋 Enviar detalles del pedido
   */
  private async sendOrderDetails(order: any, phone: string): Promise<void> {
    try {
      console.log('📋 [ExtensibleOrderFlow] Enviando detalles de la orden:', {
        orderId: order.id,
        orderNumber: order.order_number,
        phone: phone,
        userId: order.user_id
      });

      // Crear cliente de Supabase del servidor
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: provider } = await supabase
        .from('providers')
        .select('name, contact_name')
        .eq('phone', phone)
        .eq('user_id', order.user_id)  // ✅ FILTRAR POR USUARIO
        .single();

      console.log('👤 [ExtensibleOrderFlow] Proveedor para detalles:', provider);

      const message = getActionMessage('send_order_details', order, provider);
      console.log('📝 [ExtensibleOrderFlow] Mensaje a enviar:', message);

      // ✅ CORRECCIÓN: Enviar solo por Kapso para escalabilidad
      await this.sendMessageToKapso(phone, message, order.user_id);
    } catch (error) {
      console.error('❌ [ExtensibleOrderFlow] Error enviando detalles de la orden:', error);
    }
  }

  /**
   * 📄 Enviar solicitud de factura
   */
  private async sendInvoiceRequest(order: any, phone: string): Promise<void> {
    try {
        const message = getActionMessage('send_invoice_request', order);
        await this.sendMessageToKapso(phone, message, order.user_id);
    } catch (error) {
    }
  }

  /**
   * 📄 Procesar factura
   */
  private async processInvoice(order: any, phone: string): Promise<void> {
    try {
        const message = getActionMessage('process_invoice', order);
        await this.sendMessageToKapso(phone, message, order.user_id);
    } catch (error) {
    }
  }

  /**
   * 🎉 Completar orden
   */
  private async completeOrder(order: any, phone: string): Promise<void> {
    try {
        const message = getActionMessage('complete_order', order);
        await this.sendMessageToKapso(phone, message, order.user_id);
    } catch (error) {
    }
  }
}

// Exportar instancia singleton
export const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
