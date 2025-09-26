/**
 * 🔧 CONFIGURACIÓN EXTENSIBLE DEL FLUJO DE ÓRDENES
 * Permite modificar fácilmente estados, transiciones y eventos sin romper el sistema
 */

// Importar ORDER_STATUS desde orderConstants
import { ORDER_STATUS } from './orderConstants';

export const ORDER_FLOW_CONFIG = {
  // 📋 Estados del flujo (fácil de modificar)
  STATES: {
    STANDBY: 'standby',
    ENVIADO: 'enviado', 
    PENDIENTE_DE_PAGO: 'pendiente_de_pago',
    PAGADO: 'pagado'
  },

  // 🔄 Transiciones del flujo (fácil de modificar)
  TRANSITIONS: {
    // standby → enviado (cualquier mensaje del proveedor)
    [ORDER_STATUS.STANDBY]: {
      next: ORDER_STATUS.ENVIADO,
      trigger: 'provider_response',
      action: 'send_order_details'
    },
    
    // enviado → pendiente_de_pago (documento del proveedor con factura válida)
    [ORDER_STATUS.ENVIADO]: {
      next: ORDER_STATUS.PENDIENTE_DE_PAGO,
      trigger: 'invoice_received',
      action: 'process_invoice'
    },
    
    // pendiente_de_pago → pagado (comprobante del usuario)
    [ORDER_STATUS.PENDIENTE_DE_PAGO]: {
      next: ORDER_STATUS.PAGADO,
      trigger: 'payment_proof_uploaded',
      action: 'complete_order'
    }
  },

  // 📱 Mensajes por transición (fácil de personalizar)
  MESSAGES: {
    send_order_details: (order: any, provider: any) => {
      const currentDate = new Date().toLocaleDateString('es-AR');
      const items = order.items?.map((item: any) => 
        `• ${item.name || item.productName}: ${item.quantity} ${item.unit || 'unidades'} - $${item.total || item.price || 0}`
      ).join('\n') || 'No hay items especificados';

      let deliveryDate = 'No especificada';
      if (order.desired_delivery_date) {
        const date = new Date(order.desired_delivery_date).toLocaleDateString('es-AR');
        const times = order.desired_delivery_time;
        if (times && Array.isArray(times) && times.length > 0) {
          deliveryDate = `${date} - ${times.join(', ')}`;
        } else {
          deliveryDate = date;
        }
      }

      return `📋 *DETALLES DEL PEDIDO - ${currentDate} - ${provider.name}*
🆔 *Número de Orden:* ${order.order_number}
📅 *Fecha de entrega:* ${deliveryDate}
💳 *Método de pago:* ${order.payment_method || 'No especificado'}
📝 *Notas:* ${order.notes || 'Sin notas especiales'}
📦 *Items del pedido:*
${items}
---
📄 *SOLICITUD DE FACTURA*

Gracias por recibir el pedido. Por favor, envíe la factura correspondiente para proceder con el pago.

Saludos!`;
    },


    process_invoice: (order: any) => {
      return `✅ *FACTURA RECIBIDA*

La factura para la orden ${order.order_number} ha sido procesada exitosamente.

Ahora puede proceder con el pago y subir el comprobante correspondiente.

Saludos!`;
    },

    complete_order: (order: any) => {
      return `🎉 *ORDEN COMPLETADA*

La orden ${order.order_number} ha sido completada exitosamente.

¡Gracias por utilizar nuestros servicios!

Saludos!`;
    }
  },

  // 🔍 Validaciones por estado (fácil de extender)
  VALIDATIONS: {
    [ORDER_STATUS.STANDBY]: {
      canTransitionTo: [ORDER_STATUS.ENVIADO],
      requiredFields: ['order_number', 'provider_id', 'items']
    },
    [ORDER_STATUS.ENVIADO]: {
      canTransitionTo: [ORDER_STATUS.PENDIENTE_DE_PAGO],
      requiredFields: ['order_number']
    },
    [ORDER_STATUS.PENDIENTE_DE_PAGO]: {
      canTransitionTo: [ORDER_STATUS.PAGADO],
      requiredFields: ['order_number', 'receipt_url']
    },
    [ORDER_STATUS.PAGADO]: {
      canTransitionTo: [],
      requiredFields: ['order_number']
    }
  }
} as const;

// 🔧 Función para obtener la siguiente transición
export function getNextTransition(currentState: string): { next: string; trigger: string; action: string } | null {
  const transition = ORDER_FLOW_CONFIG.TRANSITIONS[currentState as keyof typeof ORDER_FLOW_CONFIG.TRANSITIONS];
  return transition || null;
}

// 🔧 Función para validar si una transición es válida
export function isValidTransition(fromState: string, toState: string): boolean {
  const validation = ORDER_FLOW_CONFIG.VALIDATIONS[fromState as keyof typeof ORDER_FLOW_CONFIG.VALIDATIONS];
  return validation?.canTransitionTo.includes(toState) || false;
}

// 🔧 Función para obtener el mensaje de una acción
export function getActionMessage(action: string, order: any, provider?: any): string {
  const messageFunc = ORDER_FLOW_CONFIG.MESSAGES[action as keyof typeof ORDER_FLOW_CONFIG.MESSAGES];
  if (typeof messageFunc === 'function') {
    return messageFunc(order, provider);
  }
  return '';
}
