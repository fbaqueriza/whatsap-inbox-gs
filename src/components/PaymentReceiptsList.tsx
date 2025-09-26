'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Send, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  DollarSign,
  Calendar,
  User,
  Eye,
  Download,
  Loader2
} from 'lucide-react';
import { usePaymentReceipts, PaymentReceiptData } from '../hooks/usePaymentReceipts';

interface PaymentReceiptsListProps {
  userId: string;
  className?: string;
  hideHeader?: boolean;
}

export default function PaymentReceiptsList({ userId, className = '', hideHeader = false }: PaymentReceiptsListProps) {
  const [sendingReceipts, setSendingReceipts] = useState<Set<string>>(new Set());
  const { isLoading, error, receipts, getPaymentReceipts, setupRealtimeSubscription, sendReceiptToProvider } = usePaymentReceipts();

  // Cargar comprobantes y configurar suscripción en tiempo real
  useEffect(() => {
    if (userId) {
      getPaymentReceipts(userId);
      setupRealtimeSubscription(userId);
    }
  }, [userId, getPaymentReceipts, setupRealtimeSubscription]);

  // Función para recargar manualmente
  const handleRefresh = useCallback(() => {
    if (userId) {
      getPaymentReceipts(userId);
    }
  }, [userId, getPaymentReceipts]);

  // Enviar comprobante a proveedor
  const handleSendReceipt = useCallback(async (receiptId: string, providerId: string) => {
    try {
      setSendingReceipts(prev => new Set(prev).add(receiptId));
      
      const result = await sendReceiptToProvider(receiptId, providerId);
      
      if (result.success) {
        alert('Comprobante enviado exitosamente al proveedor');
        // La actualización se manejará automáticamente por la suscripción en tiempo real
      } else {
        alert(`Error enviando comprobante: ${result.error}`);
      }
    } catch (error) {
      console.error('Error enviando comprobante:', error);
      alert('Error de conexión al enviar comprobante');
    } finally {
      setSendingReceipts(prev => {
        const newSet = new Set(prev);
        newSet.delete(receiptId);
        return newSet;
      });
    }
  }, [sendReceiptToProvider]);

  // Formatear fecha
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Formatear moneda
  const formatCurrency = useCallback((amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }, []);

  // Obtener icono de estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'assigned':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'processed':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Obtener texto de estado
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'processed':
        return 'Procesado';
      case 'assigned':
        return 'Asignado';
      case 'sent':
        return 'Enviado';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  // Obtener clase de estado
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Cargando comprobantes...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="p-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error cargando comprobantes</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-600">
              Si es un error de tabla no encontrada, las tablas de comprobantes deben crearse primero en Supabase.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header - Solo mostrar si no está oculto */}
      {!hideHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Comprobantes de Pago
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {receipts.length} comprobante{receipts.length !== 1 ? 's' : ''} registrado{receipts.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-xs text-green-600">Actualización automática activa</span>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Actualizar
            </button>
          </div>
        </div>
      )}

      {/* Lista de comprobantes */}
      <div className="divide-y divide-gray-200">
        {receipts.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              No hay comprobantes de pago
            </h4>
            <p className="text-sm text-gray-500">
              Los comprobantes subidos aparecerán aquí
            </p>
          </div>
        ) : (
          receipts.map((receipt) => (
            <div key={receipt.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(receipt.status)}
                    <h4 className="text-sm font-medium text-gray-900">
                      {receipt.filename}
                    </h4>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(receipt.status)}`}>
                      {getStatusText(receipt.status)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span>
                        {receipt.payment_amount ? formatCurrency(receipt.payment_amount, receipt.payment_currency) : '$0,00'}
                        {receipt.payment_amount && (
                          <span className="text-xs text-green-600 ml-1">✓</span>
                        )}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{receipt.payment_date || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>
                        {receipt.auto_assigned_provider?.name ? 
                          `Asignado a ${receipt.auto_assigned_provider.name}` : 
                          receipt.auto_assigned_provider_id ? 
                          'Asignado a proveedor' : 
                          'Sin asignar'
                        }
                      </span>
                    </div>
                    
                    {(receipt.auto_assigned_order_id || receipt.auto_assigned_order) && (
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {receipt.auto_assigned_order?.order_number ? 
                            `Orden: ${receipt.auto_assigned_order.order_number}` : 
                            `Orden: ${receipt.auto_assigned_order_id}`
                          }
                          {receipt.auto_assigned_order?.status && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded text-gray-500 bg-gray-100">
                              {receipt.auto_assigned_order.status}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    
                    {receipt.assignment_confidence && (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-gray-500">
                          Confianza: {Math.round(receipt.assignment_confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                  
                  
                  {receipt.receipt_number && (
                    <div className="mt-2 text-sm text-gray-500">
                      <span className="font-medium">Número:</span> {receipt.receipt_number}
                    </div>
                  )}
                  
                  {receipt.sent_to_provider && receipt.sent_at && (
                    <div className="mt-2 text-sm text-green-600">
                      <span className="font-medium">Enviado:</span> {formatDate(receipt.sent_at)}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {/* Ver comprobante */}
                  <button
                    onClick={() => window.open(receipt.file_url, '_blank')}
                    className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                    title="Ver comprobante"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  
                  {/* Descargar comprobante */}
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = receipt.file_url;
                      link.download = receipt.filename;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="text-gray-600 hover:text-gray-700 p-1 rounded hover:bg-gray-50 transition-colors"
                    title="Descargar comprobante"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  
                  {/* Enviar a proveedor */}
                  {receipt.auto_assigned_provider_id && !receipt.sent_to_provider && (
                    <button
                      onClick={() => handleSendReceipt(receipt.id, receipt.auto_assigned_provider_id!)}
                      disabled={sendingReceipts.has(receipt.id)}
                      className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                      title="Enviar a proveedor"
                    >
                      {sendingReceipts.has(receipt.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
