/**
 * 🔧 REFACTORIZACIÓN: Constantes estandarizadas para el flujo de órdenes
 * Flujo simplificado a 4 estados claros y consistentes
 */

export const ORDER_STATUS = {
  STANDBY: 'standby',
  ENVIADO: 'enviado',
  PENDIENTE_DE_PAGO: 'pendiente_de_pago',
  PAGADO: 'pagado'
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.STANDBY]: 'Standby',
  [ORDER_STATUS.ENVIADO]: 'Enviado',
  [ORDER_STATUS.PENDIENTE_DE_PAGO]: 'Pendiente de Pago',
  [ORDER_STATUS.PAGADO]: 'Pagado'
} as const;

export const ORDER_STATUS_DESCRIPTIONS = {
  [ORDER_STATUS.STANDBY]: 'Orden creada, pendiente de envío al proveedor',
  [ORDER_STATUS.ENVIADO]: 'Orden enviada al proveedor, esperando factura',
  [ORDER_STATUS.PENDIENTE_DE_PAGO]: 'Factura recibida, esperando comprobante de pago',
  [ORDER_STATUS.PAGADO]: 'Comprobante de pago subido, orden completada'
} as const;

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUS.STANDBY]: 'yellow',
  [ORDER_STATUS.ENVIADO]: 'blue',
  [ORDER_STATUS.PENDIENTE_DE_PAGO]: 'purple',
  [ORDER_STATUS.PAGADO]: 'green'
} as const;

export const ORDER_STATUS_ICONS = {
  [ORDER_STATUS.STANDBY]: 'Clock',
  [ORDER_STATUS.ENVIADO]: 'Send',
  [ORDER_STATUS.PENDIENTE_DE_PAGO]: 'CreditCard',
  [ORDER_STATUS.PAGADO]: 'CheckCircle'
} as const;

/**
 * 🔧 Mapeo de estados antiguos a nuevos estados estandarizados
 */
export const LEGACY_STATUS_MAPPING = {
  // Estados antiguos → Estados nuevos
  'pending': ORDER_STATUS.STANDBY,
  'pending_confirmation': ORDER_STATUS.STANDBY,
  'confirmed': ORDER_STATUS.ENVIADO,
  'sent': ORDER_STATUS.ENVIADO,
  'enviado': ORDER_STATUS.ENVIADO,
  'esperando_factura': ORDER_STATUS.ENVIADO,
  'factura_recibida': ORDER_STATUS.PENDIENTE_DE_PAGO,
  'invoice_received': ORDER_STATUS.PENDIENTE_DE_PAGO,
  'documento_recibido': ORDER_STATUS.PENDIENTE_DE_PAGO,
  'pago_pendiente': ORDER_STATUS.PENDIENTE_DE_PAGO,
  'pendiente': ORDER_STATUS.STANDBY, // Fixed: pendiente should map to standby, not pendiente_de_pago
  'pagado': ORDER_STATUS.PAGADO,
  'paid': ORDER_STATUS.PAGADO,
  'finalizado': ORDER_STATUS.PAGADO,
  'completed': ORDER_STATUS.PAGADO,
  'delivered': ORDER_STATUS.PAGADO,
  'cancelled': ORDER_STATUS.STANDBY
} as const;

/**
 * 🔧 Función para normalizar estados antiguos a nuevos
 */
export function normalizeOrderStatus(legacyStatus: string): OrderStatus {
  return LEGACY_STATUS_MAPPING[legacyStatus as keyof typeof LEGACY_STATUS_MAPPING] || ORDER_STATUS.STANDBY;
}

/**
 * 🔧 Validar si un estado es válido
 */
export function isValidOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
}

/**
 * 🔧 Obtener el siguiente estado válido en el flujo
 */
export function getNextOrderStatus(currentStatus: OrderStatus): OrderStatus | null {
  const flow = [
    ORDER_STATUS.STANDBY,
    ORDER_STATUS.ENVIADO,
    ORDER_STATUS.PENDIENTE_DE_PAGO,
    ORDER_STATUS.PAGADO
  ];
  
  const currentIndex = flow.indexOf(currentStatus);
  return currentIndex < flow.length - 1 ? flow[currentIndex + 1] : null;
}

/**
 * 🔧 Obtener el estado anterior en el flujo
 */
export function getPreviousOrderStatus(currentStatus: OrderStatus): OrderStatus | null {
  const flow = [
    ORDER_STATUS.STANDBY,
    ORDER_STATUS.ENVIADO,
    ORDER_STATUS.PENDIENTE_DE_PAGO,
    ORDER_STATUS.PAGADO
  ];
  
  const currentIndex = flow.indexOf(currentStatus);
  return currentIndex > 0 ? flow[currentIndex - 1] : null;
}
