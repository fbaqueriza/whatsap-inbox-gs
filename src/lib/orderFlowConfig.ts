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
    PAGADO: 'pagado',
    COMPROBANTE_ENVIADO: 'comprobante_enviado'
  },

  // 🔄 Transiciones del flujo (fácil de modificar)
  TRANSITIONS: {
    // standby → enviado (cualquier mensaje del proveedor)
    [ORDER_STATUS.STANDBY]: {
      next: ORDER_STATUS.ENVIADO,
      trigger: 'provider_response',
      action: 'send_order_details' // Enviar detalles del pedido cuando el proveedor responde
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
    },

    // pagado → comprobante_enviado (comprobante enviado al usuario)
    [ORDER_STATUS.PAGADO]: {
      next: ORDER_STATUS.COMPROBANTE_ENVIADO,
      trigger: 'comprobante_enviado',
      action: 'comprobante_enviado'
    }
  },

  // 📱 Mensajes por transición (fácil de personalizar)
  MESSAGES: {
    send_order_details: (order: any, provider: any) => {
      const currentDate = new Date().toLocaleDateString('es-AR');
      const items = order.items?.map((item: any) => {
        const productName = item.name || item.productName;
        const quantity = item.quantity;
        const unit = item.unit || 'unidades';
        
        // Si es texto libre (quantity=1 y unit='un'), mostrar solo el texto
        if (quantity === 1 && unit === 'un') {
          return `• ${productName}`;
        }
        
        // Si es formato estructurado, mostrar con cantidad y unidad
        return `• ${productName}: ${quantity} ${unit}`;
      }).join('\n') || 'No hay items especificados';

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

      // Mover las notas al final si existen
      const notesSection = order.notes && order.notes.trim() 
        ? `\n\nNotas: ${order.notes}` 
        : '';
      
      return `🆔 Orden: ${order.order_number}
📅 Entrega: ${deliveryDate}
💳 Pago: ${order.payment_method || 'No especificado'}

📦 Items:
${items}
${notesSection}

Gracias. Aguardamos la factura.

Saludos!`;
    },


    process_invoice: (order: any) => {
      return `✅ *FACTURA RECIBIDA*

La factura para la orden ${order.order_number} ha sido procesada exitosamente. Saludos!`;
    },

    complete_order: (order: any) => {
      return `🎉 *ORDEN COMPLETADA*

La orden ${order.order_number} ha sido completada exitosamente.

¡Gracias por utilizar nuestros servicios!

Saludos!`;
    },

    comprobante_enviado: (order: any) => {
      return `✅ *COMPROBANTE ENVIADO*

El comprobante para la orden ${order.order_number} ha sido enviado al usuario. Saludos!`;
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
      canTransitionTo: [ORDER_STATUS.COMPROBANTE_ENVIADO],
      requiredFields: ['order_number']
    },
    [ORDER_STATUS.COMPROBANTE_ENVIADO]: {
      canTransitionTo: [],
      requiredFields: ['order_number']
    }
  }
} as const;

// 🔧 Función para obtener la siguiente transición
export function getNextTransition(currentState: string): { next: string; trigger: string; action: string | null } | null {
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
