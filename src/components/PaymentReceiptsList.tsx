'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  Eye,
  Download,
  Loader2,
  Link as LinkIcon,
  X,
  Trash2,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';
import { usePaymentReceipts, PaymentReceiptData } from '../hooks/usePaymentReceipts';
import { useData } from './DataProvider';
import { Order } from '../types';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

const NOTIFICATION_STYLES: Record<NotificationType, string> = {
  success: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200'
};

interface PaymentReceiptsListProps {
  userId: string;
  className?: string;
  hideHeader?: boolean;
  orders?: Order[]; // 🔧 NUEVO: Órdenes para linkear comprobantes
}

export default function PaymentReceiptsList({ userId, className = '', hideHeader = false, orders: propOrders }: PaymentReceiptsListProps) {
  const [linkingReceiptId, setLinkingReceiptId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [isLinking, setIsLinking] = useState(false);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [notification, setNotification] = useState<{ type: NotificationType; message: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => Promise<void>; loading?: boolean } | null>(null);
  const { isLoading, error, receipts, getPaymentReceipts, setupRealtimeSubscription, sendReceiptToProvider } = usePaymentReceipts();
  const { orders: contextOrders, providers } = useData();
  
  // Usar órdenes del prop o del contexto
  const orders = propOrders || contextOrders || [];

  const visibleReceipts = receipts.filter(receipt => !receipt.sent_to_provider);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    setNotification({ message, type });
  }, []);

  const dismissNotification = useCallback(() => {
    setNotification(null);
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeout = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timeout);
  }, [notification]);

  const handleConfirmationConfirm = useCallback(async () => {
    if (!confirmation) {
      return;
    }
    setConfirmation(prev => (prev ? { ...prev, loading: true } : prev));
    try {
      await confirmation.onConfirm();
    } finally {
      setConfirmation(null);
    }
  }, [confirmation]);

  const renderNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
      default:
        return <Info className="h-4 w-4" />;
    }
  };
  
  // Función para obtener el nombre del proveedor
  const getProviderName = useCallback((providerId: string) => {
    if (!providerId) return 'Proveedor desconocido';
    const provider = providers?.find((p: any) => p.id === providerId);
    return provider?.name || `(ID: ${providerId})`;
  }, [providers]);

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

  // 🔧 NUEVO: Linkear comprobante a órdenes
  const handleLinkReceipt = useCallback(async (receiptId: string) => {
    if (selectedOrderIds.size === 0) {
      showNotification('Selecciona al menos una orden antes de linkear el comprobante.', 'info');
      return;
    }

    setIsLinking(true);
    try {
      const response = await fetch('/api/payment-receipts/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId,
          orderIds: Array.from(selectedOrderIds),
          userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification(`Comprobante linkeado a ${data.linkedOrders.length} orden(es).`, 'success');
        setLinkingReceiptId(null);
        setSelectedOrderIds(new Set());
        if (userId) {
          await getPaymentReceipts(userId);
        }
      } else {
        showNotification(`Error linkeando comprobante: ${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Error linkeando comprobante:', error);
      showNotification('Error de conexión al linkear comprobante.', 'error');
    } finally {
      setIsLinking(false);
    }
  }, [selectedOrderIds, userId, getPaymentReceipts, showNotification]);

  // 🔧 NUEVO: Deslinkear comprobante de órdenes
  const handleUnlinkReceipt = useCallback((receiptId: string) => {
    setConfirmation({
      message: '¿Desvincular este comprobante de todas las órdenes asociadas?',
      onConfirm: async () => {
        setIsLinking(true);
        try {
          const response = await fetch('/api/payment-receipts/unlink', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receiptId,
              userId
            })
          });

          const data = await response.json();
          
          if (data.success) {
            showNotification('Comprobante deslinkeado exitosamente.', 'success');
            setLinkingReceiptId(null);
            setSelectedOrderIds(new Set());
            if (userId) {
              await getPaymentReceipts(userId);
            }
          } else {
            showNotification(`Error deslinkeando comprobante: ${data.error}`, 'error');
          }
        } catch (error) {
          console.error('Error deslinkeando comprobante:', error);
          showNotification('Error de conexión al deslinkear comprobante.', 'error');
        } finally {
          setIsLinking(false);
        }
      }
    });
  }, [userId, getPaymentReceipts, showNotification]);

  const sendReceiptsBatch = useCallback(async (receiptsToSend: PaymentReceiptData[]) => {
    const sendPromises = receiptsToSend.map(receipt =>
      sendReceiptToProvider(receipt.id!, receipt.auto_assigned_provider_id!)
    );

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;

    return { successCount, errorCount };
  }, [sendReceiptToProvider]);

  // 🔧 NUEVO: Enviar comprobantes seleccionados
  const handleSendSelected = useCallback(() => {
    const selectedReceipts = visibleReceipts.filter(r => 
      selectedReceiptIds.has(r.id!) && 
      r.status === 'assigned' && 
      r.auto_assigned_provider_id && 
      !r.sent_to_provider
    );

    if (selectedReceipts.length === 0) {
      showNotification('Selecciona al menos un comprobante asignado para enviarlo.', 'info');
      return;
    }

    setConfirmation({
      message: `¿Enviar ${selectedReceipts.length} comprobante(s) seleccionado(s) y retirarlos del panel?`,
      onConfirm: async () => {
        setIsSendingAll(true);
        try {
          const { successCount, errorCount } = await sendReceiptsBatch(selectedReceipts);

          if (errorCount === 0) {
            showNotification(`${successCount} comprobante(s) enviados correctamente.`, 'success');
            setSelectedReceiptIds(new Set());
            if (userId) {
              await getPaymentReceipts(userId);
            }
          } else {
            showNotification(`${successCount} enviado(s), ${errorCount} error(es).`, 'warning');
          }
        } catch (error) {
          console.error('Error enviando comprobantes:', error);
          showNotification('Error de conexión al enviar comprobantes.', 'error');
        } finally {
          setIsSendingAll(false);
        }
      }
    });
  }, [visibleReceipts, selectedReceiptIds, sendReceiptsBatch, showNotification, userId, getPaymentReceipts]);

  const handleSendAllAndDelete = useCallback(() => {
    const assignableReceipts = visibleReceipts.filter(r =>
      r.status === 'assigned' &&
      r.auto_assigned_provider_id &&
      !r.sent_to_provider
    );

    if (assignableReceipts.length === 0) {
      showNotification('No hay comprobantes asignados pendientes de envío.', 'info');
      return;
    }

    setConfirmation({
      message: `¿Enviar ${assignableReceipts.length} comprobante(s) asignado(s) y retirarlos del panel?`,
      onConfirm: async () => {
        setIsSendingAll(true);
        try {
          const { successCount, errorCount } = await sendReceiptsBatch(assignableReceipts);

          if (errorCount === 0) {
            showNotification(`${successCount} comprobante(s) enviados correctamente.`, 'success');
            setSelectedReceiptIds(new Set());
            if (userId) {
              await getPaymentReceipts(userId);
            }
          } else {
            showNotification(`${successCount} enviado(s), ${errorCount} error(es).`, 'warning');
          }
        } catch (error) {
          console.error('Error enviando comprobantes:', error);
          showNotification('Error de conexión al enviar comprobantes.', 'error');
        } finally {
          setIsSendingAll(false);
        }
      }
    });
  }, [visibleReceipts, sendReceiptsBatch, showNotification, userId, getPaymentReceipts]);

  // 🔧 NUEVO: Seleccionar/deseleccionar todos los comprobantes asignados
  const handleSelectAll = useCallback(() => {
    const assignableReceipts = visibleReceipts.filter(r => 
      r.status === 'assigned' && r.auto_assigned_provider_id && !r.sent_to_provider
    );
    
    if (selectedReceiptIds.size === assignableReceipts.length) {
      // Deseleccionar todos
      setSelectedReceiptIds(new Set());
    } else {
      // Seleccionar todos
      setSelectedReceiptIds(new Set(assignableReceipts.map(r => r.id!)));
    }
  }, [selectedReceiptIds, visibleReceipts]);

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
        return 'Comprobante enviado';
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
      {notification && (
        <div className={`px-6 py-3 border-b flex items-center justify-between ${NOTIFICATION_STYLES[notification.type]}`}>
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center">{renderNotificationIcon(notification.type)}</span>
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={dismissNotification}
            className="text-xs font-semibold uppercase tracking-wide"
          >
            Cerrar
          </button>
        </div>
      )}

      {confirmation && (
        <div className="px-6 py-3 border-b border-yellow-200 bg-yellow-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">{confirmation.message}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleConfirmationConfirm}
              disabled={confirmation.loading || isSendingAll}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confirmation.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Confirmando...
                </>
              ) : (
                'Confirmar'
              )}
            </button>
            <button
              onClick={() => setConfirmation(null)}
              disabled={confirmation.loading}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-yellow-300 text-yellow-800 hover:bg-yellow-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header - Solo mostrar si no está oculto */}
      {!hideHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Comprobantes de Pago
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {visibleReceipts.length} comprobante{visibleReceipts.length !== 1 ? 's' : ''} registrado{visibleReceipts.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-xs text-green-600">Actualización automática activa</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Actualizar
              </button>
              {/* 🔧 NUEVO: Botón para enviar todos los comprobantes asignados */}
              {visibleReceipts.filter(r => r.status === 'assigned' && r.auto_assigned_provider_id && !r.sent_to_provider).length > 0 && (
                <button
                  onClick={handleSendAllAndDelete}
                  disabled={isSendingAll}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center space-x-1"
                >
                  {isSendingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Enviar Todos ({visibleReceipts.filter(r => r.status === 'assigned' && r.auto_assigned_provider_id && !r.sent_to_provider).length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔧 NUEVO: Botón de envío masivo - Siempre visible, incluso cuando hideHeader es true */}
      {(() => {
        const assignableReceipts = visibleReceipts.filter(r => 
          r.status === 'assigned' && r.auto_assigned_provider_id && !r.sent_to_provider
        );
        
        if (assignableReceipts.length === 0) return null;
        
        return (
          <div className="px-6 py-3 border-b border-gray-200 bg-green-50">
            <div className="flex items-center justify-between space-x-3">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {selectedReceiptIds.size === assignableReceipts.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
              </button>
              <button
                onClick={handleSendSelected}
                disabled={isSendingAll || selectedReceiptIds.size === 0}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSendingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Enviar Seleccionados ({selectedReceiptIds.size > 0 ? selectedReceiptIds.size : '0'})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Lista de comprobantes */}
      <div className="divide-y divide-gray-200">
        {visibleReceipts.length === 0 ? (
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
          visibleReceipts.map((receipt) => {
            const isAssignable = receipt.status === 'assigned' && receipt.auto_assigned_provider_id && !receipt.sent_to_provider;
            const isSelected = selectedReceiptIds.has(receipt.id!);
            
            return (
            <div key={receipt.id} className={`p-6 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
              <div className="flex items-start justify-between">
                {/* 🔧 NUEVO: Checkbox para seleccionar comprobante */}
                {isAssignable && (
                  <div className="mr-3 mt-1">
                    <button
                      onClick={() => {
                        const newSet = new Set(selectedReceiptIds);
                        if (isSelected) {
                          newSet.delete(receipt.id!);
                        } else {
                          newSet.add(receipt.id!);
                        }
                        setSelectedReceiptIds(newSet);
                      }}
                      className="text-blue-600 hover:text-blue-700 focus:outline-none"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                )}
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
                    
                    {/* 🔧 CORRECCIÓN: Solo mostrar asignación si el status es 'assigned' */}
                    {receipt.status === 'assigned' && (receipt.auto_assigned_provider_id || receipt.provider_id) && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>
                          {receipt.auto_assigned_provider?.name ? 
                            `Asignado a ${receipt.auto_assigned_provider.name}` : 
                            (receipt.auto_assigned_provider_id || receipt.provider_id) ? 
                            'Asignado a proveedor' : 
                            'Sin asignar'
                          }
                        </span>
                      </div>
                    )}
                    
                    {(receipt.auto_assigned_order_id || receipt.auto_assigned_order) && (
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {receipt.auto_assigned_order?.orderNumber ? 
                            `Orden: ${receipt.auto_assigned_order.orderNumber}` : 
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
                  
                  {/* 🔧 CORRECCIÓN: Linkear comprobante a órdenes (siempre visible para permitir cambios) */}
                  <button
                    onClick={() => {
                      setLinkingReceiptId(receipt.id!);
                      setSelectedOrderIds(new Set());
                    }}
                    className="text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                    title="Linkear a órdenes"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </button>
                  
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* 🔧 NUEVO: Modal para linkear comprobante a órdenes */}
      {linkingReceiptId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Linkear Comprobante a Órdenes</h3>
              <button
                onClick={() => {
                  setLinkingReceiptId(null);
                  setSelectedOrderIds(new Set());
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {/* 🔧 CORRECCIÓN: Mostrar orden linkeada actualmente si existe */}
              {(() => {
                const currentReceipt = receipts.find(r => r.id === linkingReceiptId);
                const linkedOrderId = currentReceipt?.auto_assigned_order_id;
                const linkedOrder = linkedOrderId ? orders.find(o => o.id === linkedOrderId) : null;
                
                if (linkedOrder) {
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Orden actualmente linkeada:
                      </p>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              Orden #{linkedOrder.orderNumber}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              <div className="flex items-center space-x-2">
                                <User className="h-3 w-3 text-gray-400" />
                                <span>{getProviderName(linkedOrder.providerId)}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                              <div className="flex items-center space-x-1">
                                <DollarSign className="h-3 w-3" />
                                <span>{formatCurrency(linkedOrder.totalAmount || 0, linkedOrder.currency || 'ARS')}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{linkedOrder.orderDate ? formatDate(typeof linkedOrder.orderDate === 'string' ? linkedOrder.orderDate : linkedOrder.orderDate.toISOString()) : 'Sin fecha'}</span>
                              </div>
                              <div className="mt-1">
                                <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${linkedOrder.status === 'pendiente_de_pago' ? 'bg-purple-100 text-purple-800' : linkedOrder.status === 'enviado' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {linkedOrder.status}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnlinkReceipt(linkingReceiptId)}
                            disabled={isLinking}
                            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center space-x-1"
                          >
                            {isLinking ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Deslinkeando...</span>
                              </>
                            ) : (
                              <>
                                <X className="h-3 w-3" />
                                <span>Deslinkear</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-3 mb-4">
                        Selecciona nuevas órdenes para cambiar el link:
                      </p>
                    </div>
                  );
                }
                return (
                  <p className="text-sm text-gray-600 mb-4">
                    Selecciona una o más órdenes para linkear este comprobante:
                  </p>
                );
              })()}
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {orders
                  .filter(order => order.status === 'pendiente_de_pago' || order.status === 'enviado')
                  .map(order => (
                    <label
                      key={order.id}
                      className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedOrderIds);
                          if (e.target.checked) {
                            newSet.add(order.id);
                          } else {
                            newSet.delete(order.id);
                          }
                          setSelectedOrderIds(newSet);
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          Orden #{order.orderNumber}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <div className="flex items-center space-x-2">
                            <User className="h-3 w-3 text-gray-400" />
                            <span>{getProviderName(order.providerId)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3" />
                            <span>{formatCurrency(order.totalAmount || 0, order.currency || 'ARS')}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{order.orderDate ? formatDate(typeof order.orderDate === 'string' ? order.orderDate : order.orderDate.toISOString()) : 'Sin fecha'}</span>
                          </div>
                          <div className="mt-1">
                            <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded ${order.status === 'pendiente_de_pago' ? 'bg-purple-100 text-purple-800' : order.status === 'enviado' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
              
              {orders.filter(order => order.status === 'pendiente_de_pago' || order.status === 'enviado').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hay órdenes pendientes de pago disponibles
                </p>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setLinkingReceiptId(null);
                    setSelectedOrderIds(new Set());
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleLinkReceipt(linkingReceiptId)}
                  disabled={selectedOrderIds.size === 0 || isLinking}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Linkeando...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      <span>Linkear ({selectedOrderIds.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
