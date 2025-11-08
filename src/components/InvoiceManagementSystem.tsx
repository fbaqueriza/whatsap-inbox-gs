'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  DollarSign,
  Users,
  Filter,
  Search,
  Edit,
  FileDown,
  Wifi,
  WifiOff,
  X,
  Copy,
  Calendar,
  Send,
  Loader2
} from 'lucide-react';
import PaymentReceiptUpload from './PaymentReceiptUpload';
import PaymentReceiptUploadModal from './PaymentReceiptUploadModal';
import PaymentReceiptsList from './PaymentReceiptsList';
import { useData } from './DataProvider';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { usePaymentReceipts } from '../hooks/usePaymentReceipts';
import EditOrderModal from './EditOrderModal';
import PaymentDataDisplay from './PaymentDataDisplay';
import { supabase } from '../lib/supabase/client';

interface PendingPayment {
  id: string;
  order_number: string;
  invoice_number: string;
  provider_name: string;
  provider_phone: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  due_date?: string;
  receipt_url: string;
  invoice_file_url?: string;
  payment_receipt_url?: string; // 🔧 NUEVO: URL del comprobante de pago
  provider_id: string;
}

interface PaymentSummary {
  provider_id: string;
  provider_name: string;
  provider_phone: string;
  provider_email: string;
  cuit: string;
  cbu: string;
  razon_social: string;
  orders: any[];
  total_amount: number;
  currency: string;
  order_count: number;
  execution_date?: string; // Fecha de ejecución seleccionada por el usuario
}

// 🔧 OPTIMIZACIÓN: Componente memoizado para filas de tabla
const OrderRow = memo(({ 
  payment, 
  onEdit, 
  onUploadReceipt, 
  formatCurrency, 
  formatDate, 
  getStatusDisplay, 
  getStatusClass 
}: {
  payment: PendingPayment;
  onEdit?: (orderId: string) => void;
  onUploadReceipt?: (orderId: string) => void;
  formatCurrency: (amount: number, currency: string) => string;
  formatDate: (date: string) => string;
  getStatusDisplay: (status: string) => string;
  getStatusClass: (status: string) => string;
}) => {
  return (
    <tr key={payment.id} className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {payment.order_number}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {payment.provider_name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {payment.invoice_number}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatCurrency(payment.total_amount, payment.currency)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(payment.status)}`}>
          {getStatusDisplay(payment.status)}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(payment.created_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(payment.id)}
              className="text-blue-600 hover:text-blue-900"
              title="Editar orden"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {onUploadReceipt && (
            <button
              onClick={() => onUploadReceipt(payment.id)}
              className="text-green-600 hover:text-green-900"
              title="Subir comprobante"
            >
              <Upload className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

OrderRow.displayName = 'OrderRow';

interface InvoiceManagementSystemProps {
  onEdit?: (orderId: string) => void;
  onUploadReceipt?: (orderId: string, file: File) => void;
}

export default function InvoiceManagementSystem({ 
  onEdit, 
  onUploadReceipt 
}: InvoiceManagementSystemProps = {}) {
  const { orders, providers, updateOrder } = useData();
  const { user } = useSupabaseAuth();
  const { receipts: paymentReceipts, sendReceiptToProvider, getPaymentReceipts } = usePaymentReceipts();
  
  // Cargar comprobantes cuando el usuario esté disponible
  useEffect(() => {
    if (user?.id) {
      getPaymentReceipts(user.id);
    }
  }, [user?.id, getPaymentReceipts]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'facturas' | 'resumen' | 'comprobantes'>('facturas');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<string | null>(null);
  const [isPaymentDataModalOpen, setIsPaymentDataModalOpen] = useState(false);
  const [isPaymentReceiptModalOpen, setIsPaymentReceiptModalOpen] = useState(false);

  // 🔧 CORREGIDO: Función para convertir orden a PendingPayment
  const convertOrderToPayment = useCallback((order: any): PendingPayment => {
    const provider = providers.find(p => p.id === order.providerId);
    
    return {
      id: order.id,
      order_number: order.orderNumber || order.order_number || `ORD-${order.id}`,
      invoice_number: order.invoiceNumber || order.invoice_number || `INV-${order.id}`,
      provider_name: provider?.name || order.provider?.name || 'Proveedor desconocido',
      provider_phone: provider?.phone || order.provider?.phone || '',
      total_amount: order.totalAmount || order.total_amount || 0,
      currency: order.currency || 'ARS',
      status: order.status || 'pending',
      created_at: order.createdAt || order.created_at || new Date().toISOString(),
      due_date: order.dueDate || order.due_date,
      receipt_url: order.receiptUrl || order.receipt_url || '',
      invoice_file_url: order.invoiceFileUrl || order.receiptUrl || order.receipt_url || '',
      payment_receipt_url:
        order.paymentReceiptUrl ||
        (order as any).payment_receipt_url ||
        undefined, // 🔧 NUEVO: URL del comprobante de pago
      provider_id: order.providerId || order.provider_id || ''
    };
  }, [providers]);

  // 🔧 CORREGIDO: Procesar órdenes cuando cambian en DataProvider
  useEffect(() => {
    if (orders && orders.length > 0) {
      const payments = orders.map(convertOrderToPayment);
      setPendingPayments(payments);
      setLastUpdate(new Date());
    } else {
      setPendingPayments([]);
    }
  }, [orders, convertOrderToPayment]);

  // 🔧 NUEVO: Sistema de procesamiento de facturas
  const processInvoiceFile = useCallback(async (file: File, orderId: string, providerId: string) => {
    setIsLoading(true);
    try {
      // Verificar perfil del usuario: Razón Social y CUIT obligatorios
      const { data: sessionResult } = await supabase.auth.getSession();
      const sessionData = sessionResult?.session;
      let canProceed = true;
      try {
        const token = sessionData?.access_token || '';
        const profileRes = await fetch('/api/user/profile', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          const rz = profileJson?.profile?.razon_social;
          const cu = profileJson?.profile?.cuit;
          if (!rz || !cu) {
            canProceed = false;
          }
        }
      } catch {}
      if (!canProceed) {
        alert('Completa Razón Social y CUIT en tu perfil antes de subir facturas.');
        return { success: false, error: 'Perfil incompleto' };
      }

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', orderId);
      formData.append('providerId', providerId);
      formData.append('userId', user?.id || '');

      const uploadResponse = await fetch('/api/facturas/upload-invoice', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      // 2. Procesar contenido de la factura
      const processResponse = await fetch('/api/facturas/process-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          fileUrl: uploadData.fileUrl,
          providerId: providerId,
          userId: user?.id || ''
        })
      });

      const processData = await processResponse.json();

      if (processData.success) {
        // 3. Actualizar datos extraídos
        const extractedData = processData.extractedData;
        
        // Validar que los datos extraídos correspondan al proveedor
        if (extractedData.providerId && extractedData.providerId !== providerId) {
          console.warn('⚠️ Proveedor de la factura no coincide con la orden');
        }

        // Actualizar la orden con los datos extraídos
        const updateResponse = await fetch('/api/orders/update-invoice-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            invoiceData: {
              invoice_number: extractedData.invoiceNumber,
              total_amount: extractedData.totalAmount,
              invoice_date: extractedData.invoiceDate,
              due_date: extractedData.dueDate,
              currency: extractedData.currency || 'ARS',
              status: 'factura_recibida' // Estado que se mostrará como "Pendiente de Pago"
            }
          })
        });

        const updateData = await updateResponse.json();
        
        if (updateData.success) {
          // Actualizar estado local
          setLastUpdate(new Date());
          return {
            success: true,
            extractedData: extractedData,
            message: 'Factura procesada exitosamente'
          };
        }
      }

      return {
        success: true,
        message: 'Factura subida, procesamiento manual requerido'
      };

    } catch (error) {
      console.error('Error procesando factura:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 🔧 NUEVO: Validar datos de factura contra orden
  const validateInvoiceData = useCallback((extractedData: any, order: PendingPayment) => {
    const validations = {
      amountMatch: false,
      providerMatch: false,
      dateValid: false,
      warnings: [] as string[]
    };

    // Validar monto (tolerancia del 5%)
    if (extractedData.totalAmount) {
      const tolerance = order.total_amount * 0.05;
      validations.amountMatch = Math.abs(extractedData.totalAmount - order.total_amount) <= tolerance;
      
      if (!validations.amountMatch) {
        validations.warnings.push(
          `Monto de factura (${extractedData.totalAmount}) no coincide con orden (${order.total_amount})`
        );
      }
    }

    // Validar proveedor
    if (extractedData.providerId) {
      validations.providerMatch = extractedData.providerId === order.provider_id;
      
      if (!validations.providerMatch) {
        validations.warnings.push('Proveedor de la factura no coincide con la orden');
      }
    }

    // Validar fecha (no debe ser futura)
    if (extractedData.invoiceDate) {
      const invoiceDate = new Date(extractedData.invoiceDate);
      const today = new Date();
      validations.dateValid = invoiceDate <= today;
      
      if (!validations.dateValid) {
        validations.warnings.push('Fecha de factura es futura');
      }
    }

    return validations;
  }, []);



  // 🔧 CORREGIDO: Generar resumen de pagos - Ahora genera datos de pago
  const generatePaymentSummary = useCallback(async () => {
    if (selectedPayments.size === 0) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/facturas/payment-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedPayments)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPaymentSummary(data.paymentSummary);
        setActiveTab('resumen');
      } else {
        console.error('Error generando resumen:', data.error);
      }
    } catch (error) {
      console.error('Error en la petición:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPayments]);

  // Manejar selección de facturas
  const handlePaymentSelection = (paymentId: string, checked: boolean) => {
    const newSelection = new Set(selectedPayments);
    if (checked) {
      newSelection.add(paymentId);
    } else {
      newSelection.delete(paymentId);
    }
    setSelectedPayments(newSelection);
  };

  // Seleccionar todas las facturas
  const selectAllPayments = () => {
    if (selectedPayments.size === pendingPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(pendingPayments.map(p => p.id)));
    }
  };

  // 🔧 CORREGIDO: Filtrar órdenes por búsqueda y estado (mostrar todas las órdenes)
  const filteredPayments = pendingPayments.filter(payment => {
    const matchesSearch = 
    payment.provider_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  

  // 🔧 OPTIMIZACIÓN: Formateo de fecha memoizado
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Formatear moneda
  // 🔧 OPTIMIZACIÓN: Formateo de moneda memoizado
  const formatCurrency = useCallback((amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS'
    }).format(amount);
  }, []);

  // 🔧 OPTIMIZACIÓN: Funciones memoizadas para evitar re-renders
  const getStatusDisplay = useCallback((status: string) => {
    const statusMap: { [key: string]: string } = {
      'standby': 'Standby',
      'enviado': 'Enviado',
      'esperando_factura': 'Esperando Factura',
      'pendiente_de_pago': 'Pendiente de Pago',
      'pagado': 'Pagado',
      'comprobante_enviado': 'Comprobante enviado'
    };
    return statusMap[status] || status;
  }, []);

  // 🔧 OPTIMIZACIÓN: Clases de estado memoizadas
  const getStatusClass = useCallback((status: string) => {
    switch (status) {
      case 'pagado':
      case 'comprobante_enviado':
        return 'bg-green-100 text-green-800';
      case 'pendiente_de_pago':
        return 'bg-purple-100 text-purple-800';
      case 'enviado':
        return 'bg-blue-100 text-blue-800';
      case 'esperando_factura':
        return 'bg-yellow-100 text-yellow-800';
      case 'standby':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // 🔧 NUEVO: Formatear tiempo desde última actualización
  const formatTimeSinceUpdate = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    return `${Math.floor(diffInSeconds / 3600)}h`;
  };


  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header con tabs simplificados */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('facturas')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'facturas'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-1">
              <FileText className="h-4 w-4" />
              <span className="font-medium">Órdenes ({pendingPayments.length})</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('resumen')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'resumen'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="inline-block w-4 h-4 mr-2" />
            Resumen de Pagos
          </button>
          
          <button
            onClick={() => setActiveTab('comprobantes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comprobantes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="inline-block w-4 h-4 mr-2" />
            Comprobantes
          </button>
        </nav>
      </div>

      {/* 🔧 CORREGIDO: Indicador de estado simplificado */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-gray-600">
              Actualización automática desde DataProvider
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Última actualización: {formatTimeSinceUpdate(lastUpdate)}
          </div>
        </div>
      </div>

      {/* Contenido de los tabs */}
      <div className="p-6">
        {/* Tab: Órdenes */}
        {activeTab === 'facturas' && (
          <div className="space-y-4">
            {/* Barra de herramientas */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por proveedor, orden o factura..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="pending_confirmation">Pendiente de Confirmación</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="enviado">Enviados</option>
                  <option value="factura_recibida">Pendiente de Pago</option>
                  <option value="factura_con_errores">Factura con Errores</option>
                  <option value="pagado">Pagados</option>
                  <option value="comprobante_enviado">Comprobante enviado</option>
                  <option value="finalizado">Finalizados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </div>

              <div className="flex gap-2">
                {/* 🔧 CORRECCIÓN: Botón para enviar comprobantes solo de las órdenes seleccionadas */}
                {(() => {
                  // Solo mostrar el botón si hay órdenes seleccionadas
                  if (selectedPayments.size === 0) {
                    return null;
                  }
                  
                  // Filtrar comprobantes que están asignados a las órdenes seleccionadas
                  const selectedOrderIds = Array.from(selectedPayments);
                  const receiptsForSelectedOrders = paymentReceipts?.filter(r => 
                    r.status === 'assigned' && 
                    r.auto_assigned_provider_id && 
                    !r.sent_to_provider &&
                    (r.auto_assigned_order_id && selectedOrderIds.includes(r.auto_assigned_order_id))
                  ) || [];
                  
                  if (receiptsForSelectedOrders.length > 0) {
                    return (
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Enviar ${receiptsForSelectedOrders.length} comprobante(s) de las órdenes seleccionadas y eliminarlos del panel?`)) {
                            return;
                          }
                          
                          const sendPromises = receiptsForSelectedOrders.map(receipt => 
                            sendReceiptToProvider(receipt.id!, receipt.auto_assigned_provider_id!)
                          );
                          
                          const results = await Promise.all(sendPromises);
                          const successCount = results.filter(r => r.success).length;
                          const errorCount = results.length - successCount;
                          
                          if (errorCount === 0) {
                            alert(`✅ ${successCount} comprobante(s) enviado(s) exitosamente`);
                            // Limpiar selección después de enviar
                            setSelectedPayments(new Set());
                          } else {
                            alert(`⚠️ ${successCount} enviado(s), ${errorCount} error(es)`);
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2"
                      >
                        <Send className="h-4 w-4" />
                        <span>Enviar Comprobantes ({receiptsForSelectedOrders.length})</span>
                      </button>
                    );
                  }
                  return null;
                })()}
                
                <button
                  onClick={selectAllPayments}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selectedPayments.size === pendingPayments.length ? 'Deseleccionar' : 'Seleccionar'} Todo
                </button>
                
                                 {selectedPayments.size > 0 && (
                   <>
                     <button
                       onClick={generatePaymentSummary}
                       disabled={isLoading}
                       className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                     >
                       <DollarSign className="inline-block w-4 h-4 mr-2" />
                      Generar Datos de Pago ({selectedPayments.size})
                     </button>
                     <button
                       onClick={() => setIsPaymentReceiptModalOpen(true)}
                       disabled={isLoading}
                       className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                     >
                       <Upload className="inline-block w-4 h-4 mr-2" />
                       Subir Comprobante ({selectedPayments.size})
                     </button>
                   </>
                 )}
              </div>
            </div>

            {/* Tabla de facturas */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedPayments.size === pendingPayments.length}
                        onChange={selectAllPayments}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Factura/Orden
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment, index) => (
                    <tr key={`${payment.id}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedPayments.has(payment.id)}
                          onChange={(e) => handlePaymentSelection(payment.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.order_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.invoice_number}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.provider_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.provider_phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payment.total_amount, payment.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(payment.status)}`}>
                          {getStatusDisplay(payment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>{formatDate(payment.created_at)}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(payment.created_at).toLocaleTimeString('es-AR', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: false 
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {/* 🔧 CORREGIDO: Solo botón de editar que abre modal de edición de orden */}
                          <button
                            onClick={() => {
                              // 🔧 NUEVO: Abrir modal de edición de orden
                              const order = orders.find(o => o.id === payment.id);
                              if (order) {
                                setSelectedOrder(order);
                                setIsEditModalOpen(true);
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                            title="Editar orden"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* 🔧 NUEVO: Botón para mostrar datos de pago */}
                          {payment.status === 'pendiente_de_pago' && (
                            <button
                              onClick={() => {
                                setSelectedOrderForPayment(payment.id);
                                setIsPaymentDataModalOpen(true);
                              }}
                              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                              title="Ver datos de pago"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}

                          
                          {/* 🔧 CORRECCIÓN: Botones separados para ver factura y comprobante */}
                          {(payment.invoice_file_url || payment.receipt_url) && (
                            <button
                              onClick={() => window.open((payment.invoice_file_url || payment.receipt_url)!, '_blank')}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                              title="Ver factura"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Mostrar botón de comprobante si existe payment_receipt_url */}
                          {payment.payment_receipt_url && (
                            <button
                              onClick={() => window.open(payment.payment_receipt_url!, '_blank')}
                              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                              title="Ver comprobante de pago"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredPayments.length === 0 && (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {searchTerm || statusFilter !== 'all' ? 'No se encontraron facturas' : 'No hay facturas pendientes'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Intenta ajustar los filtros de búsqueda.'
                    : 'Todas las facturas han sido procesadas.'
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Comprobantes de Pago */}
        {activeTab === 'comprobantes' && (
          <div className="space-y-6">
            {/* Header con botón de subida */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Comprobantes de Pago
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Gestiona los comprobantes de pago enviados a proveedores
                </p>
              </div>
              <button
                onClick={() => setIsPaymentReceiptModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Upload className="inline-block w-4 h-4 mr-2" />
                Subir Comprobante
              </button>
            </div>

            <PaymentReceiptsList 
              userId={user?.id || ''} 
              className="mb-6"
              hideHeader={true}
            />
          </div>
        )}

        {/* Tab: Resumen de Pagos */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Resumen de Pagos por Proveedor
              </h3>
            </div>

            {paymentSummary.length > 0 ? (
              <div className="space-y-4">
                {/* Tabla simple de datos de pago (estilo Excel) */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                  <style dangerouslySetInnerHTML={{__html: `
                    .payment-table-selectable,
                    .payment-table-selectable * {
                      -webkit-user-select: text !important;
                      -moz-user-select: text !important;
                      -ms-user-select: text !important;
                      user-select: text !important;
                    }
                    .payment-table-selectable th,
                    .payment-table-selectable td {
                      cursor: text;
                    }
                    .payment-table-selectable input {
                      pointer-events: auto;
                    }
                  `}} />
                  <div className="overflow-x-auto payment-table-selectable">
                    <table className="min-w-full divide-y divide-gray-200 border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b border-gray-300">
                            Razón Social
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b border-gray-300">
                            CUIT
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b border-gray-300">
                            CBU
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b border-gray-300">
                            Monto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase border-b border-gray-300">
                            Fecha de Ejecución
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paymentSummary.map((provider) => {
                          const defaultDate = new Date().toISOString().split('T')[0];
                          const executionDate = provider.execution_date || defaultDate;
                          
                          return (
                            <tr 
                              key={provider.provider_id} 
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                                {provider.razon_social || provider.provider_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono border-b border-gray-200">
                                {provider.cuit || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-mono border-b border-gray-200">
                                {provider.cbu || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                                {formatCurrency(provider.total_amount, provider.currency)}
                              </td>
                              <td className="px-4 py-3 border-b border-gray-200">
                                <input
                                  type="text"
                                  value={executionDate}
                                  placeholder={defaultDate}
                                  onChange={(e) => {
                                    const updatedSummary = paymentSummary.map(p => 
                                      p.provider_id === provider.provider_id 
                                        ? { ...p, execution_date: e.target.value }
                                        : p
                                    );
                                    setPaymentSummary(updatedSummary);
                                  }}
                                  className="text-sm border border-gray-400 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 italic text-gray-700"
                                  style={{ 
                                    userSelect: 'text', 
                                    WebkitUserSelect: 'text', 
                                    msUserSelect: 'text',
                                    cursor: 'text',
                                    fontStyle: 'italic',
                                    color: '#374151'
                                  }}
                                  onFocus={(e) => e.target.select()}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-900 border-t border-gray-300">
                            Total General:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600 border-t border-gray-300">
                      {formatCurrency(
                        paymentSummary.reduce((sum, p) => sum + p.total_amount, 0),
                        paymentSummary[0]?.currency || 'ARS'
                      )}
                          </td>
                          <td className="px-4 py-3 border-t border-gray-300"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Instrucción para copiar */}
                <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="font-medium text-blue-900 mb-1">💡 Cómo copiar la tabla:</p>
                  <p className="text-blue-800">
                    Haz clic y arrastra el mouse sobre las celdas que deseas copiar (como en Excel). Luego presiona <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-xs">Ctrl+C</kbd> (o <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-xs">Cmd+C</kbd> en Mac) y pégalo directamente en Excel. La fecha tiene un valor por defecto (hoy) pero puedes editarla haciendo clic en el campo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No hay resumen de pagos
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Selecciona facturas pendientes para generar el resumen.
                </p>
              </div>
            )}
          </div>
                 )}
       </div>

       {/* Modal para subir comprobante de pago */}
       <PaymentReceiptUploadModal
         isOpen={isPaymentReceiptModalOpen}
         onClose={() => setIsPaymentReceiptModalOpen(false)}
         selectedOrderIds={Array.from(selectedPayments)}
         userId={user?.id || ''}
         orders={orders.map(o => ({ id: o.id, total_amount: (o as any).total_amount ?? o.totalAmount ?? 0 }))}
         onSuccess={() => {
           // 🔧 CORREGIDO: No necesitamos recargar, los datos vienen del DataProvider
            setSelectedPayments(new Set());
         }}
       />

       {/* Modal de edición de orden original */}
       {selectedOrder && (
         <EditOrderModal
           isOpen={isEditModalOpen}
           onClose={() => {
             setSelectedOrder(null);
             setIsEditModalOpen(false);
           }}
           order={selectedOrder}
           providers={providers}
           onSave={async (orderId, updates) => {
             try {
               const updatedOrder = { ...selectedOrder, ...updates };
               await updateOrder(updatedOrder);
               setSelectedOrder(null);
               setIsEditModalOpen(false);
               setLastUpdate(new Date());
             } catch (error) {
               console.error('Error actualizando orden:', error);
               alert('Error al actualizar la orden');
             }
           }}
         />
       )}

       {/* 🔧 NUEVO: Modal de datos de pago */}
       {selectedOrderForPayment && (
         <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 ${isPaymentDataModalOpen ? 'block' : 'hidden'}`}>
           <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
             <div className="mt-3">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-medium text-gray-900">
                   Datos de Pago - Orden #{selectedOrderForPayment}
                 </h3>
                 <button
                   onClick={() => {
                     setSelectedOrderForPayment(null);
                     setIsPaymentDataModalOpen(false);
                   }}
                   className="text-gray-400 hover:text-gray-600"
                 >
                   <X className="h-6 w-6" />
                 </button>
               </div>
               
               <PaymentDataDisplay 
                 orderId={selectedOrderForPayment}
                 className="mb-4"
               />
               
               <div className="flex justify-end space-x-3 mt-6">
                 <button
                   onClick={() => {
                     setSelectedOrderForPayment(null);
                     setIsPaymentDataModalOpen(false);
                   }}
                   className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                 >
                   Cerrar
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

     </div>
   );
 }
