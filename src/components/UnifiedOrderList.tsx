'use client';

import { useState, useMemo } from 'react';
import { Order, Provider } from '../types';
import {
  Plus,
  ShoppingCart,
  Send,
  MessageSquare,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Clipboard,
  Check,
  Download,
  ChevronDown,
  Edit,
  Eye,
} from 'lucide-react';
import { Menu } from '@headlessui/react';
import ComprobanteButton from './ComprobanteButton';

interface UnifiedOrderListProps {
  orders: Order[];
  providers: Provider[];
  showCreateButton?: boolean;
  onCreateOrder?: () => void;
  onChatGeneral?: () => void;
  maxItems?: number;
  showViewAllButton?: boolean;
  viewAllUrl?: string;
  onOrderClick?: (order: Order) => void;
  onSendOrder?: (orderId: string) => void;
  onUploadPaymentProof?: (orderId: string, file: File) => void;
  onConfirmReception?: (orderId: string) => void;
  onOpenReceipt?: (receiptUrl: string | undefined) => void;
  onEditOrder?: (order: Order) => void;
  expandedOrders?: Set<string>;
  onToggleExpanded?: (orderId: string) => void;
}

export default function UnifiedOrderList({
  orders,
  providers,
  showCreateButton = false,
  onCreateOrder,
  onChatGeneral,
  maxItems,
  showViewAllButton = false,
  viewAllUrl,
  onOrderClick,
  onSendOrder,
  onUploadPaymentProof,
  onConfirmReception,
  onOpenReceipt,
  onEditOrder,
  expandedOrders = new Set(),
  onToggleExpanded,
}: UnifiedOrderListProps) {
  const [showItems, setShowItems] = useState<Set<string>>(new Set());

  // 🔧 OPTIMIZACIÓN: Filtrar órdenes según el estado con mejor lógica
  const filteredOrders = useMemo(() => {
    // Incluir órdenes activas (no finalizadas ni canceladas)
    const activeOrders = orders.filter(order => 
      !['finalizado', 'cancelled', 'pagado'].includes(order.status)
    );
    
    // Ordenar por fecha de creación (más recientes primero)
    const sortedOrders = activeOrders.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    
    if (maxItems) {
      return sortedOrders.slice(0, maxItems);
    }
    return sortedOrders;
  }, [orders, maxItems]);

  // 🔧 REFACTORIZADO: Estados estandarizados
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'standby':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'enviado':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'esperando_factura':
        return <FileText className="h-4 w-4 text-orange-500" />;
      case 'pendiente_de_pago':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'pagado':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'standby':
        return 'Standby';
      case 'enviado':
        return 'Enviado';
      case 'esperando_factura':
        return 'Esperando Factura';
      case 'pendiente_de_pago':
        return 'Pendiente de Pago';
      case 'pagado':
        return 'Pagado';
      default:
        return status;
    }
  };

  const getProviderName = (providerId: string) => {
    if (!providerId) return 'Proveedor desconocido';
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || `(ID: ${providerId})`;
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'standby':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'enviado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'esperando_factura':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'pendiente_de_pago':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pagado':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const canSendOrder = (order: Order) => {
    return order.status === 'standby';
  };

  const canUploadProof = (order: Order) => {
    return order.status === 'pendiente_de_pago';
  };

  const canConfirmReception = (order: Order) => {
    return order.status === 'pagado';
  };

  const toggleItems = (orderId: string) => {
    setShowItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  if (filteredOrders.length === 0) {
      return (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">No hay pedidos activos</div>
              {showCreateButton && onCreateOrder && (
                <button
                  onClick={onCreateOrder}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
            Crear pedido
                </button>
              )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con botones de acción */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Pedidos ({filteredOrders.length})
        </h3>
        <div className="flex space-x-2">
              {onChatGeneral && (
                <button
                  onClick={onChatGeneral}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
              <MessageSquare className="h-4 w-4 mr-1" />
                  Chat general
                </button>
              )}
          {showCreateButton && onCreateOrder && (
            <button
              onClick={onCreateOrder}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo pedido
            </button>
          )}
          </div>
        </div>

      {/* Lista de órdenes */}
      <div className="space-y-3">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Header de la orden */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getStatusIcon(order.status)}
                <div>
                    <div className="font-medium text-gray-900">
                    {order.orderNumber || `Orden #${order.id.slice(0, 8)}`}
                    </div>
                    <div className="text-sm text-gray-500">
                                         {getProviderName(order.providerId)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </span>
                
                <Menu as="div" className="relative inline-block text-left">
                  <Menu.Button className="inline-flex items-center p-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <ChevronDown className="h-4 w-4" />
                  </Menu.Button>
                  <Menu.Items className="absolute right-0 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                    <div className="py-1">
                {onOrderClick && (
                        <Menu.Item>
                          {({ active }) => (
                  <button
                    onClick={() => onOrderClick(order)}
                              className={`${
                                active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                              } group flex items-center w-full px-4 py-2 text-sm`}
                            >
                              <MessageSquare className="mr-3 h-4 w-4" />
                              Chat con proveedor
                            </button>
                          )}
                        </Menu.Item>
                      )}
                      
                      {onEditOrder && (
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={() => onEditOrder(order)}
                              className={`${
                                active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                              } group flex items-center w-full px-4 py-2 text-sm`}
                            >
                              <Edit className="mr-3 h-4 w-4" />
                              Editar pedido
                            </button>
                          )}
                        </Menu.Item>
                      )}
                      
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => toggleItems(order.id)}
                            className={`${
                              active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                            } group flex items-center w-full px-4 py-2 text-sm`}
                          >
                            <Eye className="mr-3 h-4 w-4" />
                            {showItems.has(order.id) ? 'Ocultar detalles' : 'Ver detalles'}
                  </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Menu>
              </div>
            </div>

            {/* Información básica */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                             <div>
                 <span className="font-medium">Total:</span> ${order.totalAmount} {order.currency}
               </div>
               <div>
                 <span className="font-medium">Fecha:</span> {formatDate(order.orderDate)}
               </div>
               <div>
                 <span className="font-medium">Vencimiento:</span> {formatDate(order.dueDate)}
               </div>
               <div>
                 <span className="font-medium">Factura:</span> {order.invoiceNumber || 'Pendiente'}
               </div>
            </div>

            {/* Detalles expandibles */}
            {showItems.has(order.id) && (
              <div className="border-t border-gray-200 pt-3">
                {/* Items del pedido */}
                {order.items && order.items.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Items del pedido:</h4>
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                                                 <div key={index} className="flex justify-between text-sm">
                           <span>{item.productName}: {item.quantity} {item.unit}</span>
                           <span>${item.total || 0}</span>
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas */}
                {order.notes && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-900 mb-1">Notas:</h4>
                    <p className="text-sm text-gray-600">{order.notes}</p>
                  </div>
                )}

                {/* Acciones según el estado */}
                <div className="flex flex-wrap gap-2">
                  {canSendOrder(order) && onSendOrder && (
                    <button
                      onClick={() => onSendOrder(order.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Enviar pedido
                    </button>
                  )}

                                     {canUploadProof(order) && onUploadPaymentProof && (
                     <label className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 cursor-pointer">
                       <Upload className="h-4 w-4 mr-1" />
                       Subir comprobante
                       <input
                         type="file"
                         className="hidden"
                         accept=".pdf,.jpg,.jpeg,.png"
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             onUploadPaymentProof(order.id, file);
                           }
                         }}
                       />
                     </label>
                   )}

                  {canConfirmReception(order) && onConfirmReception && (
                  <button
                      onClick={() => onConfirmReception(order.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                      <Check className="h-4 w-4 mr-1" />
                      Confirmar recepción
                  </button>
                )}
                
                                     {order.receiptUrl && onOpenReceipt && (
                  <button
                       onClick={() => onOpenReceipt(order.receiptUrl)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                      <Download className="h-4 w-4 mr-1" />
                      Ver comprobante
                  </button>
                )}
              </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botón "Ver todos" */}
      {showViewAllButton && viewAllUrl && filteredOrders.length > 0 && (
        <div className="text-center pt-4">
          <a
            href={viewAllUrl}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Ver todos los pedidos
            <ChevronDown className="ml-2 h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
