/**
 * 🚀 SERVICIO DE FLUJO DE ÓRDENES EXTENSIBLE
 * Usa configuración para permitir modificaciones fáciles del flujo
 */

// Importar cliente de Supabase del servidor para usar en el webhook
import { metaWhatsAppService } from './metaWhatsAppService';
import { PhoneNumberService } from './phoneNumberService';
import { ORDER_FLOW_CONFIG, getNextTransition, isValidTransition, getActionMessage } from './orderFlowConfig';
import { ORDER_STATUS } from './orderConstants';

export interface FlowResult {
  success: boolean;
  message?: string;
  orderId?: string;
  newStatus?: string;
  errors?: string[];
}

export class ExtensibleOrderFlowService {
  private static instance: ExtensibleOrderFlowService;

  static getInstance(): ExtensibleOrderFlowService {
    if (!ExtensibleOrderFlowService.instance) {
      ExtensibleOrderFlowService.instance = new ExtensibleOrderFlowService();
    }
    return ExtensibleOrderFlowService.instance;
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
        } else {
          console.log('⚠️ [ExtensibleOrderFlow] Estado "enviado" requiere documento (factura) para continuar');
          return { success: false, message: 'Se requiere una factura válida para continuar el flujo' };
        }
      } else if (foundOrder.status === 'pendiente_de_pago') {
        // 🔧 CORRECCIÓN: En estado 'pendiente_de_pago', NO permitir transiciones por mensaje de texto
        // Solo debe cambiar a 'pagado' cuando se suba un comprobante de pago válido
        console.log('⚠️ [ExtensibleOrderFlow] Estado "pendiente_de_pago" - no se permiten transiciones por mensaje de texto');
        return { success: false, message: 'No hay transición disponible' };
      }

      // Para otros estados (standby), permitir mensajes de texto
      console.log('✅ [ExtensibleOrderFlow] Procesando respuesta del proveedor en estado:', foundOrder.status);

      // Obtener la siguiente transición basada en el estado actual
      console.log('🔄 [ExtensibleOrderFlow] Obteniendo transición para estado:', foundOrder.status);
      const transition = getNextTransition(foundOrder.status);
      console.log('🔄 [ExtensibleOrderFlow] Transición obtenida:', transition);
      
      if (!transition) {
        console.log('❌ [ExtensibleOrderFlow] No hay transición disponible para este estado');
        return { success: false, message: 'No hay transición disponible para este estado' };
      }

      // Validar que la transición es válida
      const isValid = isValidTransition(foundOrder.status, transition.next);
      console.log('✅ [ExtensibleOrderFlow] Transición válida:', isValid);
      
      if (!isValid) {
        console.log('❌ [ExtensibleOrderFlow] Transición inválida');
        return { success: false, errors: ['Transición inválida'] };
      }

      // 🔧 CORRECCIÓN: Solo ejecutar UNA transición por vez
      console.log(`🔄 [ExtensibleFlow] Ejecutando transición: ${foundOrder.status} → ${transition.next}`);
      const result = await this.executeTransition(foundOrder, transition, normalizedPhone, message);
      
      // 🔧 IMPORTANTE: No ejecutar transiciones adicionales automáticamente
      // El proveedor debe responder de nuevo para la siguiente transición
      console.log('✅ [ExtensibleOrderFlow] Transición completada - esperando nueva respuesta del proveedor');
      return result;

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
    try {

      switch (action) {
        case 'send_order_details':
          await this.sendOrderDetails(order, phone);
          break;
        case 'send_invoice_request':
          await this.sendInvoiceRequest(order, phone);
          break;
        case 'process_invoice':
          await this.processInvoice(order, phone);
          break;
        case 'complete_order':
          await this.completeOrder(order, phone);
          break;
        default:
      }

    } catch (error) {
    }
  }

  /**
   * 📋 Enviar detalles del pedido
   */
  private async sendOrderDetails(order: any, phone: string): Promise<void> {
    try {
      // Crear cliente de Supabase del servidor
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: provider } = await supabase
        .from('providers')
        .select('name')
        .eq('phone', phone)
        .single();

      const message = getActionMessage('send_order_details', order, provider);
      await metaWhatsAppService.sendMessage(phone, message, order.user_id);
    } catch (error) {
    }
  }

  /**
   * 📄 Enviar solicitud de factura
   */
  private async sendInvoiceRequest(order: any, phone: string): Promise<void> {
    try {
      const message = getActionMessage('send_invoice_request', order);
      await metaWhatsAppService.sendMessage(phone, message, order.user_id);
    } catch (error) {
    }
  }

  /**
   * 📄 Procesar factura
   */
  private async processInvoice(order: any, phone: string): Promise<void> {
    try {
      const message = getActionMessage('process_invoice', order);
      await metaWhatsAppService.sendMessage(phone, message, order.user_id);
    } catch (error) {
    }
  }

  /**
   * 🎉 Completar orden
   */
  private async completeOrder(order: any, phone: string): Promise<void> {
    try {
      const message = getActionMessage('complete_order', order);
      await metaWhatsAppService.sendMessage(phone, message, order.user_id);
    } catch (error) {
    }
  }
}

// Exportar instancia singleton
export const extensibleOrderFlowService = ExtensibleOrderFlowService.getInstance();
