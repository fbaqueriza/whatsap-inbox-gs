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
  
  // Helper functions - EXACTAMENTE como en la página original
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'pending_confirmation':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'enviado':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'factura_recibida':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'pagado':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'finalizado':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending_confirmation':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'enviado':
        return 'bg-blue-100 text-blue-800';
      case 'factura_recibida':
        return 'bg-purple-100 text-purple-800';
      case 'pagado':
        return 'bg-green-100 text-green-800';
      case 'finalizado':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
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

  // Ordenar órdenes por fecha descendente - EXACTAMENTE como en la página original
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.createdAt || b.orderDate || 0);
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
          currentOrders.slice(0, maxOrders).map((order) => (
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
                        {order.status === 'pending' ? 'Pendiente' :
                         order.status === 'pending_confirmation' ? 'Pendiente de Confirmación' :
                         order.status === 'confirmed' ? 'Confirmado' :
                         order.status === 'enviado' ? 'Enviado' :
                         order.status === 'factura_recibida' ? 'Factura Recibida' :
                         order.status === 'pagado' ? 'Pagado' :
                         order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {getProviderName(order.providerId)} • {order.items.length} ítems • {formatDate(order.orderDate)}
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
          ))
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
