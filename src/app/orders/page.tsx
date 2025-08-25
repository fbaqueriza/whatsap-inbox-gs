'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import SuggestedOrders from '../../components/SuggestedOrders';
import CreateOrderModal from '../../components/CreateOrderModal';
import EditOrderModal from '../../components/EditOrderModal';
import ComprobanteButton from '../../components/ComprobanteButton';
import PendingOrderList from '../../components/PendingOrderList';

import { useChat } from '../../contexts/ChatContext';
import { useGlobalChat } from '../../contexts/GlobalChatContext';
import { ChatProvider } from '../../contexts/ChatContext';
import { GlobalChatProvider } from '../../contexts/GlobalChatContext';
import WhatsAppSync from '../../components/WhatsAppSync';
import GlobalChatWrapper from '../../components/GlobalChatWrapper';
import { Order, OrderItem, Provider, StockItem, OrderFile } from '../../types';
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

} from 'lucide-react';
import { DataProvider, useData } from '../../components/DataProvider';
import es from '../../locales/es';
import { Menu } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OrderNotificationService } from '../../lib/orderNotificationService';



export default function OrdersPageWrapper() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  if (!authLoading && !user) {
    if (typeof window !== 'undefined') router.push('/auth/login');
    return null;
  }
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Cargando...</p></div></div>;
  }
  return (
    <ChatProvider>
      <GlobalChatProvider>
        <WhatsAppSync />
        <DataProvider userEmail={user?.email ?? undefined} userId={user?.id}>
            {user && <OrdersPage user={user} />}
          </DataProvider>
        <GlobalChatWrapper />
      </GlobalChatProvider>
    </ChatProvider>
  );
}

type OrdersPageProps = { user: any };
function OrdersPage({ user }: OrdersPageProps) {
  const { orders, providers, stockItems, addOrder, updateOrder, deleteOrder, fetchAll } = useData();
  // Only keep local state for modal and suggestedOrder
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suggestedOrder, setSuggestedOrder] = useState<any>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);


  
  // Chat context
  const { openChat } = useChat();
  const { openGlobalChat } = useGlobalChat();
  

  
  // Remove all other local state for orders/providers/stockItems
  // All handlers now use Supabase CRUD only
  const handleCreateOrder = async (orderData: any) => {
    const newOrder = await addOrder(orderData, user.id);
    setIsCreateModalOpen(false);
    setSuggestedOrder(null);

    // Enviar notificación automática al proveedor
    try {
      const provider = providers.find(p => p.id === orderData.providerId);
      if (provider) {
        const notificationData = {
          order: newOrder as Order,
          provider: provider,
          items: orderData.items
        };

        const notificationSent = await OrderNotificationService.sendOrderNotification(notificationData);
        
        if (notificationSent) {
          console.log('✅ Notificación de pedido enviada exitosamente');
          
          // Forzar recarga de mensajes después de enviar la orden
          setTimeout(() => {
            // Disparar un evento personalizado para actualizar el chat
            if (newOrder) {
              window.dispatchEvent(new CustomEvent('orderSent', {
                detail: { orderId: newOrder.id, providerId: orderData.providerId }
              }));
            }
          }, 2000); // Esperar 2 segundos para que se procese el mensaje
        } else {
          console.error('❌ Error enviando notificación de pedido');
        }
      }
    } catch (error) {
      console.error('Error enviando notificación de pedido:', error);
    }
  };

  const handleSuggestedOrderCreate = (suggestedOrder: any) => {
    setSuggestedOrder(suggestedOrder);
    setIsCreateModalOpen(true);
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  
  // Re-add getStatusIcon and getStatusColor helpers
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'enviado':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'factura_recibida':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'pagado':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'finalizado':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Add getProviderName helper
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
  // Add state and handlers for WhatsApp chat
  const handleOrderClick = (order: Order) => {
    
    // Encontrar el proveedor correspondiente
    const provider = providers.find(p => p.id === order.providerId);

    
    if (provider) {
      // Normalizar el número de teléfono - remover espacios y guiones, agregar + si no tiene
      let normalizedPhone = provider.phone || '';
      
      // Remover espacios, guiones y paréntesis
      normalizedPhone = normalizedPhone.replace(/[\s\-\(\)]/g, '');
      
      // Agregar + si no tiene
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = `+${normalizedPhone}`;
      }
      

      
      // Crear contacto para el chat
      const contact = {
        id: provider.id,
        name: provider.name,
        phone: normalizedPhone,
        providerId: provider.id,
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0
      };
      
      // Abrir el chat global
      openGlobalChat(contact);
    } else {
      console.error('❌ handleOrderClick - No se encontró el proveedor para orderId:', order.id);
    }
  };

  
  // Ordenar órdenes por fecha descendente (created_at) - los más recientes primero
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.createdAt || b.orderDate || 0);
    return dateB.getTime() - dateA.getTime();
  });
  const currentOrders = sortedOrders.filter(order => !['finalizado', 'cancelled', 'delivered'].includes(order.status));
  let finishedOrders = sortedOrders.filter(order => ['finalizado', 'delivered'].includes(order.status));

  // Eliminar todas las definiciones duplicadas de:
  // - handleSendOrder
  // - handleUploadPaymentProof
  // - handleConfirmReception
  // Solo debe quedar la versión después del sorting.

  // Filtros
  // if (filterProvider) finishedOrders = finishedOrders.filter(o => o.providerId === filterProvider);
  // if (filterStartDate) finishedOrders = finishedOrders.filter(o => new Date(o.orderDate) >= new Date(filterStartDate));
  // if (filterEndDate) finishedOrders = finishedOrders.filter(o => new Date(o.orderDate) <= new Date(filterEndDate));

  // After sorting and before render, define the handlers:
  // 1. Cambiar el tipo de estado a: 'pendiente', 'factura_recibida', 'pagado', 'enviado', 'finalizado'.
  // 2. Modificar los handlers:
  const handleSendOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await updateOrder({ ...order, status: 'enviado' });
      
      // Enviar notificación de estado actualizado
      try {
        const provider = providers.find(p => p.id === order.providerId);
        if (provider) {
          await OrderNotificationService.sendOrderStatusUpdate(order, provider, 'enviado');
        }
      } catch (error) {
        console.error('Error enviando notificación de estado:', error);
      }
      
      setTimeout(async () => {
        // Refetch orders para obtener el estado actualizado
        await fetchAll();
        
        // Obtener datos del proveedor para la orden de pago
        const provider = providers.find(p => p.id === order.providerId);
        const bankInfo = {
          accountNumber: provider?.cbu || '1234567890'
        };
        const totalAmount = 1000; // Monto extraído de la factura PDF
        
        const orderWithInvoice = {
          ...order,
          status: 'factura_recibida' as 'factura_recibida',
          invoiceNumber: 'INV-MOCK-001',
          receiptUrl: '/mock-factura.pdf',
          bankInfo: bankInfo,
          totalAmount: totalAmount,
        } as Order;
        

        await updateOrder(orderWithInvoice);
        
        // Enviar notificación de factura recibida
        try {
          if (provider) {
            await OrderNotificationService.sendOrderStatusUpdate(orderWithInvoice, provider, 'factura_recibida');
          }
        } catch (error) {
          console.error('Error enviando notificación de factura:', error);
        }
        
        // Refetch para asegurar que se actualice la UI
        await fetchAll();
      }, 2000);
    }
  };
  const handleUploadPaymentProof = async (orderId: string, file: File) => {
    try {
      // Crear un nombre único para el archivo
      const fileExt = file.name.split('.').pop();
      const fileName = `comprobante_${orderId}_${Date.now()}.${fileExt}`;
      
      // Crear una URL de datos (data URL) que funcione localmente
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        

        
        // Actualizar la orden con la data URL del comprobante
        const order = orders.find(o => o.id === orderId);
        if (order) {
          await updateOrder({ ...order, receiptUrl: dataUrl, status: 'pagado' });

        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error en handleUploadPaymentProof:', error);
    }
  };
  const handleConfirmReception = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await updateOrder({ ...order, status: 'finalizado' });
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleSaveOrderEdit = async (orderId: string, updates: {
    desiredDeliveryDate?: Date;
    paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
    additionalFiles?: OrderFile[];
    notes?: string;
  }) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      const updatedOrder = {
        ...order,
        ...updates,
        updatedAt: new Date(),
      };
      
      await updateOrder(updatedOrder);
      
      setIsEditModalOpen(false);
      setEditingOrder(null);
    } catch (error) {
      console.error('Error actualizando pedido:', error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await updateOrder({ ...order, status: 'cancelled' });
      }
      setIsEditModalOpen(false);
      setEditingOrder(null);
    } catch (error) {
      console.error('Error cancelando pedido:', error);
    }
  };

  // 1. Agregar estado para filtros
  const [filterProvider, setFilterProvider] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  // 2. Aplicar filtros a finishedOrders
  const filteredFinishedOrders = finishedOrders.filter(order => {
    const providerMatch = !filterProvider || order.providerId === filterProvider;
    const startMatch = !filterStartDate || new Date(order.orderDate) >= new Date(filterStartDate);
    const endMatch = !filterEndDate || new Date(order.orderDate) <= new Date(filterEndDate);
    return providerMatch && startMatch && endMatch;
  });

  // 1. Botón 'Enviar pedido' cuando estado === 'pending'
  // 2. Mostrar nombre del proveedor con getProviderName(order.providerId)
  // 3. Corregir formato de fecha:
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

  // Función para abrir comprobantes (data URLs o URLs normales)
  const openReceipt = (receiptUrl: string | undefined) => {
    if (!receiptUrl) return;
    
    if (receiptUrl.startsWith('data:')) {
      // Para data URLs, crear un blob y abrirlo
      const byteString = atob(receiptUrl.split(',')[1]);
      const mimeString = receiptUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      // Para URLs normales
      window.open(receiptUrl, '_blank');
    }
  };
  // 4. Mostrar precio solo si estado es 'factura_recibida', 'pagado', 'enviado', 'finalizado'
  const showPrice = (status: string) => ['factura_recibida','pagado','enviado','finalizado'].includes(status);
  
  // Función para mostrar orden de pago
  const showPaymentOrder = (order: Order) => {
    if (order.status !== 'factura_recibida' || !order.bankInfo) return null;
    
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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {es.orders.title}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {es.orders.description}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                {es.orders.newOrder}
              </button>
              {/* Botón para carga masiva de comprobantes */}
              <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Subir comprobantes
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      // setBulkReceipts(Array.from(e.target.files)); // This state was removed
                      // setIsBulkModalOpen(true); // This state was removed
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Pedidos Pendientes de Confirmación */}
        <PendingOrderList />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 sm:px-0">
          {/* Suggested Orders */}
          <div className="lg:col-span-1">
            <SuggestedOrders
              stockItems={stockItems}
              providers={providers}
              onCreateOrder={handleSuggestedOrderCreate}
            />
          </div>
          {/* Orders List */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {es.orders.currentOrdersTitle} ({currentOrders.length})
                </h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {currentOrders.map((order) => (
                  <li key={order.id} className="py-3 px-2 flex flex-col gap-1 bg-white rounded-lg shadow mb-3">
                    <div className="flex flex-col sm:flex-row justify-between gap-4 w-full">
                      {/* Lado izquierdo: info del pedido */}
                      <div className="flex-1 min-w-0 sm:w-7/12">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(order.status)}
                          <span className="font-medium text-gray-900">{order.orderNumber}</span>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>{order.status === 'pending' ? 'Pendiente' : order.status === 'enviado' ? 'Enviado' : order.status === 'factura_recibida' ? 'Factura recibida' : order.status === 'pagado' ? 'Pagado' : order.status === 'finalizado' ? 'Finalizado' : order.status === 'cancelled' ? 'Cancelado' : order.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-1">
                          <span>{getProviderName(order.providerId)}</span>
                          <span>•</span>
                          <span>{order.items.length} ítems</span>
                          <span>•</span>
                          {showPrice(order.status) && <span>{order.totalAmount} {order.currency}</span>}
                          <span>•</span>
                          <span>{formatDate(order.createdAt || order.orderDate)}</span>
                        </div>
                        

                        
                        <div className="flex flex-col gap-1 mt-1 text-xs text-gray-600">
                          {order.items.slice(0, 2).map((item, index) => (
                            <span key={index}>{item.productName} - {item.quantity} {item.unit}</span>
                          ))}
                          {order.items.length > 2 && (
                            <span className="text-gray-400">+{order.items.length - 2} más</span>
                          )}
                        </div>
                        
                        {/* Orden de pago - solo en estado factura_recibida */}
                        {showPaymentOrder(order)}
                      </div>
                                             {/* Lado derecho: botones de acción */}
                       <div className="flex flex-col items-end gap-2 sm:w-5/12 min-w-[160px]">
                         
                         {/* Botón de chat */}
                         <button
                           onClick={() => handleOrderClick(order)}
                           className="inline-flex items-center p-2 rounded-md text-xs font-medium border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                           title="Abrir chat con proveedor"
                         >
                           <MessageSquare className="h-4 w-4" />
                         </button>
                         
                         {/* Editar pedido - disponible en cualquier estado */}
                         <button
                           onClick={() => handleEditOrder(order)}
                           className="inline-flex items-center p-2 rounded-md text-xs font-medium border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                           title="Editar pedido"
                         >
                           <Edit className="h-4 w-4" />
                         </button>

                        {/* Enviar pedido - solo en estado pending */}
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleSendOrder(order.id)}
                            className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500"
                          >
                            <Send className="h-4 w-4 mr-1" /> Enviar pedido
                          </button>
                        )}
                        
                        {/* Descargar factura - cuando hay factura disponible */}
                        {['factura_recibida','pagado','enviado','finalizado'].includes(order.status) && (
                          <a
                            href={order.receiptUrl || '/mock-factura.pdf'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                          >
                            <FileText className="h-4 w-4 mr-1" /> Descargar factura
                          </a>
                        )}
                        
                        {/* Subir comprobante - solo en estado factura_recibida */}
                        {order.status === 'factura_recibida' && (
                          <ComprobanteButton
                            comprobante={null}
                            onUpload={(file) => handleUploadPaymentProof(order.id, file)}
                            onView={() => { if(order.receiptUrl) window.open(order.receiptUrl, '_blank'); }}
                          />
                        )}
                        
                        {/* Ver comprobante - cuando hay comprobante disponible */}
                        {['pagado','finalizado'].includes(order.status) && order.receiptUrl && (
                          <button
                            onClick={() => openReceipt(order.receiptUrl)}
                            className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                          >
                            <Upload className="h-4 w-4 mr-1" /> Ver comprobante
                          </button>
                        )}
                        
                        {/* Confirmar recepción - solo en estado pagado */}
                        {order.status === 'pagado' && (
                          <button
                            className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium border border-green-200 text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                            onClick={() => handleConfirmReception(order.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Confirmar recepción
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* Tabla de Órdenes Finalizadas mejorada */}
            <div className="bg-gray-50 shadow overflow-hidden sm:rounded-md mt-8">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h3 className="text-lg font-medium text-gray-800">
                  Órdenes finalizadas ({filteredFinishedOrders.length})
                </h3>
                <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={filterProvider}
                    onChange={e => setFilterProvider(e.target.value)}
                  >
                    <option value="">Todos los proveedores</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-xs"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-xs"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                  />
                </div>
              </div>
              <ul className="divide-y divide-gray-200">
                {filteredFinishedOrders.map((order) => (
                  <li key={order.id} className="py-3 px-2 flex flex-col gap-1 bg-white rounded-lg shadow mb-3">
                    <div className="flex flex-col sm:flex-row justify-between gap-4 w-full">
                      {/* Lado izquierdo: info básica del pedido */}
                      <div className="flex-1 min-w-0 sm:w-7/12">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(order.status)}
                          <span className="font-medium text-gray-900">{order.orderNumber}</span>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800`}>
                            Finalizada
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-1">
                          <span>{getProviderName(order.providerId)}</span>
                          <span>•</span>
                          <span>{order.items.length} ítems</span>
                          <span>•</span>
                          <span>{order.totalAmount} {order.currency}</span>
                          <span>•</span>
                          <span>{formatDate(order.orderDate)}</span>
                        </div>
                        {/* Botón para expandir/contraer detalles */}
                        <button
                          onClick={() => toggleOrderExpansion(order.id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          <ChevronDown 
                            className={`h-3 w-3 transition-transform ${expandedOrders.has(order.id) ? 'rotate-180' : ''}`} 
                          />
                          {expandedOrders.has(order.id) ? 'Ocultar detalles' : 'Ver detalles'}
                        </button>
                      </div>
                      {/* Lado derecho: botón de documentos */}
                      <div className="flex flex-col items-end gap-1 sm:w-5/12 min-w-[160px] justify-center">
                        <Menu as="div" className="relative inline-block text-left">
                          <Menu.Button className="inline-flex items-center px-4 py-2 rounded-md text-xs font-medium transition border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400">
                            Ver documentos
                          </Menu.Button>
                          <Menu.Items className="absolute right-0 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-[9999]" style={{ top: 'auto', bottom: '100%', marginBottom: '0.5rem' }}>
                            <div className="py-1 flex flex-col gap-1">
                              <button
                                className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!order.invoiceNumber}
                                onClick={() => { if(order.invoiceNumber) window.open('/mock-factura.pdf', '_blank'); }}
                              >
                                {order.invoiceNumber ? 'Descargar factura' : 'Factura no disponible'}
                              </button>
                              {order.receiptUrl ? (
                                <button
                                  onClick={() => openReceipt(order.receiptUrl)}
                                  className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 text-left"
                                >
                                  Ver comprobante
                                </button>
                              ) : (
                                <span className="block px-4 py-2 text-xs text-gray-400 text-left cursor-not-allowed">
                                  Comprobante no disponible
                                </span>
                              )}
                            </div>
                          </Menu.Items>
                        </Menu>
                      </div>
                    </div>
                    
                    {/* Detalles expandibles */}
                    {expandedOrders.has(order.id) && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Información del proveedor */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Información del proveedor</h4>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div><strong>Proveedor:</strong> {getProviderName(order.providerId)}</div>
                              <div><strong>Fecha del pedido:</strong> {formatDate(order.orderDate)}</div>
                              <div><strong>Fecha de vencimiento:</strong> {formatDate(order.dueDate)}</div>
                              {order.desiredDeliveryDate && (
                                <div><strong>Fecha de entrega deseada:</strong> {formatDate(order.desiredDeliveryDate)}</div>
                              )}
                              {order.paymentMethod && (
                                <div><strong>Forma de pago:</strong> {order.paymentMethod}</div>
                              )}
                              {order.notes && (
                                <div><strong>Notas:</strong> {order.notes}</div>
                              )}
                            </div>
                          </div>
                          
                          {/* Información de pago */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Información de pago</h4>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div><strong>Total:</strong> {order.totalAmount} {order.currency}</div>
                              {order.invoiceNumber && (
                                <div><strong>Número de factura:</strong> {order.invoiceNumber}</div>
                              )}
                              {order.bankInfo && (
                                <div><strong>CBU:</strong> {order.bankInfo.accountNumber}</div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Archivos adicionales */}
                        {order.additionalFiles && order.additionalFiles.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Archivos adicionales</h4>
                            <div className="bg-gray-50 rounded-md p-3">
                              <div className="space-y-2">
                                {order.additionalFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center">
                                      <FileText className="h-3 w-3 text-gray-500 mr-2" />
                                      <span className="text-gray-700">{file.fileName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-gray-500">
                                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                                      </span>
                                      <a
                                        href={file.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        Ver
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Lista de ítems */}
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Ítems del pedido</h4>
                          <div className="bg-gray-50 rounded-md p-3">
                            <div className="space-y-2">
                              {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-xs">
                                  <span className="text-gray-700">{item.productName}</span>
                                  <span className="text-gray-600">
                                    {item.quantity} {item.unit} - ${item.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        
        {/* Tabla de Pedidos */}
        <div className="mt-8 px-4 sm:px-0">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Tabla de Pedidos ({orders.length})
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Vista completa de todos los pedidos con sus archivos
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Factura
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comprobante
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.orderDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getProviderName(order.providerId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(order.status)}
                          <span className="ml-2 text-sm text-gray-900">
                            {order.status === 'pending' && 'Pendiente'}
                            {order.status === 'enviado' && 'Enviado'}
                            {order.status === 'factura_recibida' && 'Factura Recibida'}
                            {order.status === 'pagado' && 'Pagado'}
                            {order.status === 'finalizado' && 'Finalizado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {showPrice(order.status) ? `${order.totalAmount} ${order.currency}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.invoiceNumber ? (
                          <a
                            href="/mock-factura.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Descargar
                          </a>
                        ) : (
                          <span className="text-gray-400">No disponible</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.receiptUrl ? (
                          <a
                            href={order.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Ver
                          </a>
                        ) : (
                          <span className="text-gray-400">No disponible</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 px-4 sm:px-0">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ShoppingCart className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  ¿Cómo gestionar pedidos?
                </h3>
                                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>Crear pedido:</strong> Haz clic en "Crear nuevo pedido" para iniciar un pedido</li>
                        <li><strong>Editar pedido:</strong> Haz clic en "Editar" para modificar fecha de entrega, método de pago o agregar archivos</li>
                        <li><strong>Enviar pedido:</strong> Una vez creado, haz clic en "Enviar pedido" para notificar al proveedor</li>
                        <li><strong>Descargar factura:</strong> Cuando recibas la factura, descárgala y revisa los detalles de pago</li>
                        <li><strong>Subir comprobante:</strong> Después de pagar, sube el comprobante de pago</li>
                        <li><strong>Confirmar recepción:</strong> Una vez recibido el pedido, confirma la recepción</li>
                        <li><strong>Chat con proveedor:</strong> Usa el botón de chat para comunicarte directamente</li>
                        <li><strong>Ver detalles:</strong> En pedidos finalizados, haz clic en "Ver detalles" para expandir la información</li>
                        <li><strong>Estados del pedido:</strong> 
                          <ul className="ml-4 mt-1 space-y-1">
                            <li>• <strong>Pendiente:</strong> Pedido creado, listo para enviar</li>
                            <li>• <strong>Enviado:</strong> Pedido enviado al proveedor</li>
                            <li>• <strong>Factura recibida:</strong> Proveedor envió la factura</li>
                            <li>• <strong>Pagado:</strong> Comprobante de pago subido</li>
                            <li>• <strong>Enviado por proveedor:</strong> Proveedor confirmó envío</li>
                            <li>• <strong>Finalizado:</strong> Pedido recibido y confirmado</li>
                          </ul>
                        </li>
                      </ul>
                    </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateOrder={handleCreateOrder}
        providers={providers}
        stockItems={stockItems}
        suggestedOrder={suggestedOrder}
        selectedProviderId={null}
      />

             {/* Edit Order Modal */}
       <EditOrderModal
         isOpen={isEditModalOpen}
         onClose={() => {
           setIsEditModalOpen(false);
           setEditingOrder(null);
         }}
         order={editingOrder}
         providers={providers}
         onSave={handleSaveOrderEdit}
         onCancel={handleCancelOrder}
       />


      

      
    </div>
  );
}
