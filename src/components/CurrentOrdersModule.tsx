'use client';

import React from 'react';
import { Order, Provider } from '../types';
import {
  Plus,
  Send,
  MessageSquare,
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import ComprobanteButton from './ComprobanteButton';

interface CurrentOrdersModuleProps {
  orders: Order[];
  providers: Provider[];
  onOrderClick: (order: Order) => void;
  onSendOrder: (orderId: string) => void;
  onUploadPaymentProof: (orderId: string, file: File) => void;
  onConfirmReception: (orderId: string) => void;
  onOpenReceipt: (receiptUrl: string | undefined) => void;
  onCreateOrder: () => void;
  onOpenChat: () => void;
  showCreateButton?: boolean;
  maxOrders?: number;
  title?: string;
  className?: string;
}

export default function CurrentOrdersModule({
  orders,
  providers,
  onOrderClick,
  onSendOrder,
  onUploadPaymentProof,
  onConfirmReception,
  onOpenReceipt,
  onCreateOrder,
  onOpenChat,
  showCreateButton = true,
  maxOrders = 5,
  title = "Pedidos actuales",
  className = ""
}: CurrentOrdersModuleProps) {
  
  // 🔧 FUNCIÓN UNIFICADA: Obtener nombre del proveedor
  const getProviderName = (providerId: string) => {
    if (!providerId) return 'Proveedor desconocido';
    if (!providers || providers.length === 0) {
      return `(ID: ${providerId})`;
    }
    const provider = providers.find((p: Provider) => p.id === providerId);
    if (provider && provider.name) {
      return provider.name;
    } else {
      return `(ID: ${providerId})`;
    }
  };

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

  // 🔧 REFACTORIZADO: Colores de estado estandarizados
  const getStatusColor = (status: string) => {
    switch (status) {
      case "standby":
        return "bg-yellow-100 text-yellow-800";
      case "enviado":
        return "bg-blue-100 text-blue-800";
      case "esperando_factura":
        return "bg-orange-100 text-orange-800";
      case "pendiente_de_pago":
        return "bg-purple-100 text-purple-800";
      case "pagado":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // 🔧 FUNCIÓN UNIFICADA: Formatear fecha
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

  // 🔧 FUNCIÓN UNIFICADA: Mostrar orden de pago
  const showPaymentOrder = (order: Order) => {
    if (order.status !== 'pendiente_de_pago' || !order.bankInfo) return null;
    
    return (
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Orden de Pago</h4>
        <div className="text-xs text-blue-800 space-y-1">
          <div><strong>CBU:</strong> {order.bankInfo.accountNumber}</div>
          <div><strong>Monto a pagar:</strong> {order.totalAmount} {order.currency}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-blue-50 border-l-4 border-blue-400 rounded-lg p-6 shadow ${className}`}>
      <h2 className="text-xl font-bold text-blue-800 mb-4">{title}</h2>
      
      {orders.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">No hay pedidos actuales</div>
          {showCreateButton && (
            <div className="flex justify-center space-x-3">
              <button
                onClick={onCreateOrder}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
        <div className="space-y-4">
          {orders.slice(0, maxOrders).map((order) => (
            <div key={order.id} className="bg-white rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(order.status)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="font-medium text-gray-900">
                        {getProviderName(order.providerId)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(order.createdAt || order.orderDate)}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status === 'standby' ? 'Standby' :
                         order.status === 'enviado' ? 'Enviado' :
                         order.status === 'esperando_factura' ? 'Esperando Factura' :
                         order.status === 'pendiente_de_pago' ? 'Pendiente de Pago' :
                         order.status === 'pagado' ? 'Pagado' :
                         order.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  
                  {/* Botón de chat */}
                  <button
                    onClick={() => onOrderClick(order)}
                    className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                    title="Abrir chat con proveedor"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </button>
                  
                  {/* Enviar pedido - solo en estado standby */}
                  {order.status === 'standby' && (
                    <button
                      onClick={() => onSendOrder(order.id)}
                      className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500"
                    >
                      <Send className="h-4 w-4 mr-1" /> Enviar pedido
                    </button>
                  )}
                  
                  {/* Descargar factura - cuando hay factura disponible */}
                  {['pendiente_de_pago','pagado','enviado'].includes(order.status) && order.receipt_url && (
                    <a
                      href={order.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                    >
                      <FileText className="h-4 w-4 mr-1" /> Descargar factura
                    </a>
                  )}
                  
                  {/* Subir comprobante - solo en estado pendiente_de_pago */}
                  {order.status === 'pendiente_de_pago' && (
                    <ComprobanteButton
                      comprobante={null}
                      onUpload={(file) => onUploadPaymentProof(order.id, file)}
                      onView={() => { if(order.receiptUrl) onOpenReceipt(order.receiptUrl); }}
                    />
                  )}
                  
                  {/* Ver comprobante - cuando hay comprobante disponible */}
                  {['pagado','finalizado'].includes(order.status) && order.receiptUrl && (
                    <button
                      onClick={() => onOpenReceipt(order.receiptUrl)}
                      className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                    >
                      <Upload className="h-4 w-4 mr-1" /> Ver comprobante
                    </button>
                  )}
                  
                  {/* Confirmar recepción - solo en estado pagado */}
                  {order.status === 'pagado' && (
                    <button
                      className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-green-200 text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                      onClick={() => onConfirmReception(order.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Confirmar recepción
                    </button>
                  )}
                </div>
              </div>
              
              {order.items && order.items.length > 0 && (
                <div className="text-xs text-gray-600">
                  {order.items.slice(0, 3).map((item, index) => (
                    <span key={index} className="mr-2">
                      {item.productName}: {item.quantity} {item.unit}
                    </span>
                  ))}
                  {order.items.length > 3 && (
                    <span className="text-gray-400">+{order.items.length - 3} más</span>
                  )}
                </div>
              )}
               
              {/* Orden de pago - solo en estado pendiente_de_pago */}
              {showPaymentOrder(order)}
            </div>
          ))}
          
          {orders.length > maxOrders && (
            <div className="text-center">
              <button
                onClick={() => window.location.href = '/orders'}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Ver todos los pedidos ({orders.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
