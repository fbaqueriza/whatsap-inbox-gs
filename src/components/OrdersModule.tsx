'use client';

import React from 'react';
import { Order, Provider } from '../types';
import {
  Plus,
  MessageSquare,
  Edit,
  ShoppingCart,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
  FileText,
  X,
  Eye,
  Upload,
} from 'lucide-react';

interface OrdersModuleProps {
  orders: Order[];
  providers: Provider[];
  onOrderClick: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onCreateOrder: () => void;
  onOpenChat: () => void;
  showCreateButton?: boolean;
  maxOrders?: number;
  title?: string;
  className?: string;
}

export default function OrdersModule({
  orders,
  providers,
  onOrderClick,
  onEditOrder,
  onCreateOrder,
  onOpenChat,
  showCreateButton = true,
  maxOrders = 10,
  title = "Órdenes Actuales",
  className = ""
}: OrdersModuleProps) {
  
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'standby':
        return 'bg-yellow-100 text-yellow-800';
      case 'enviado':
        return 'bg-blue-100 text-blue-800';
      case 'esperando_factura':
        return 'bg-orange-100 text-orange-800';
      case 'pendiente_de_pago':
        return 'bg-purple-100 text-purple-800';
      case 'pagado':
        return 'bg-green-100 text-green-800';
      case 'comprobante_enviado':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProviderName = (providerId: string) => {
    if (!providerId) return 'Proveedor desconocido';
    const provider = providers.find((p: Provider) => p.id === providerId);
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
      minute: '2-digit'
    });
  };

  // Ordenar órdenes por fecha de actualización descendente (más recientes primero)
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.updatedAt || b.createdAt || b.orderDate || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const currentOrders = sortedOrders.filter(order => 
    !['finalizado', 'cancelled', 'delivered'].includes(order.status)
  );

  return (
    <div className={`bg-white shadow rounded-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {title} ({currentOrders.length})
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Pedidos en proceso y pendientes de confirmación
        </p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {currentOrders.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay órdenes actuales</p>
            {showCreateButton && (
              <div className="mt-4 flex justify-center space-x-3">
                <button
                  onClick={onCreateOrder}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nuevo pedido
                </button>
                <button
                  onClick={onOpenChat}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat general
                </button>
              </div>
            )}
          </div>
        ) : (
          currentOrders.slice(0, maxOrders).map((order) => {
            const invoiceLink =
              order.invoiceFileUrl ||
              order.receiptUrl ||
              (order as any).receipt_url ||
              undefined;
            const paymentLink =
              order.paymentReceiptUrl ||
              (order as any).payment_receipt_url ||
              (order as any).comprobante_url ||
              undefined;

            return (
              <div key={order.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {order.orderNumber}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(order.status)}`}>
                          {order.status === 'standby' ? 'Standby' :
                           order.status === 'enviado' ? 'Enviado' :
                           order.status === 'esperando_factura' ? 'Esperando Factura' :
                           order.status === 'pendiente_de_pago' ? 'Pendiente de Pago' :
                           order.status === 'pagado' ? 'Pagado' :
                           order.status === 'comprobante_enviado' ? 'Comprobante enviado' :
                           order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {getProviderName(order.providerId)} • {order.items?.length || 0} ítems • {formatDate(order.orderDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onOrderClick(order)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Chat con proveedor"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    {invoiceLink && (
                      <button
                        onClick={() => window.open(invoiceLink as string, '_blank')}
                        className="p-2 text-gray-400 hover:text-blue-600"
                        title="Ver factura"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                    {paymentLink && (
                      <button
                        onClick={() => window.open(paymentLink as string, '_blank')}
                        className="p-2 text-gray-400 hover:text-green-600"
                        title="Ver comprobante de pago"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onEditOrder(order)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Editar orden"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {currentOrders.length > maxOrders && (
        <div className="px-6 py-4 border-t border-gray-200 text-center">
          <button
            onClick={() => window.location.href = '/orders'}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Ver todas las órdenes ({currentOrders.length})
          </button>
        </div>
      )}
    </div>
  );
}
