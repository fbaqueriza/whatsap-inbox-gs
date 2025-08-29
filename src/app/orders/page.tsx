'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import SuggestedOrders from '../../components/SuggestedOrders';
import CreateOrderModal from '../../components/CreateOrderModal';
import EditOrderModal from '../../components/EditOrderModal';
import ComprobanteButton from '../../components/ComprobanteButton';
import UnifiedOrderList from '../../components/UnifiedOrderList';

import { useChat } from '../../contexts/ChatContext';
import { useGlobalChat } from '../../contexts/GlobalChatContext';
import { ChatProvider } from '../../contexts/ChatContext';
import { GlobalChatProvider } from '../../contexts/GlobalChatContext';
import GlobalChatWrapper from '../../components/GlobalChatWrapper';
import { Order, Provider, StockItem, OrderFile } from '../../types';
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
  Search,
  Filter,
} from 'lucide-react';
import { DataProvider, useData } from '../../components/DataProvider';
import { useRouter } from 'next/navigation';
import { OrderNotificationService } from '../../lib/orderNotificationService';
import { Menu } from '@headlessui/react';
import es from '../../locales/es';
import { useOrdersRealtime } from '../../hooks/useSupabaseRealtime';


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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suggestedOrder, setSuggestedOrder] = useState<any>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  // Estados para filtros y búsqueda
  const [providerSearchTerm, setProviderSearchTerm] = useState('');
  
  // Chat context
  const { openChat } = useChat();
  const { openGlobalChat } = useGlobalChat();
  
  // 🔧 OPTIMIZACIÓN: MANEJADORES REALTIME SILENCIOSOS
  const handleNewOrder = useCallback((payload: any) => {
    // Solo log en desarrollo y solo si hay cambios reales
    if (process.env.NODE_ENV === 'development' && payload.new?.id) {
      console.log('🔄 Nueva orden:', payload.new.id);
    }
    fetchAll();
  }, [fetchAll]);

  const handleOrderUpdate = useCallback((payload: any) => {
    // Solo log si hay cambio de estado
    if (payload.old?.status !== payload.new?.status) {
      console.log('🔄 Orden actualizada:', payload.new?.id, payload.old?.status, '→', payload.new?.status);
    }
    fetchAll();
  }, [fetchAll]);

  const handleOrderDelete = useCallback((payload: any) => {
    console.log('🗑️ Orden eliminada:', payload.old?.id);
    fetchAll();
  }, [fetchAll]);

  // 🔧 OPTIMIZACIÓN: SUSCRIPCIÓN REALTIME SILENCIOSA
  const { isSubscribed } = useOrdersRealtime(handleNewOrder, handleOrderUpdate, handleOrderDelete);
  
  // Solo mostrar estado inicial de suscripción
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 Realtime:', isSubscribed ? '✅ Conectado' : '❌ Desconectado');
    }
  }, [isSubscribed]);

  // Helper functions
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

  const openReceipt = (receiptUrl: string | undefined) => {
    if (!receiptUrl) return;
    if (receiptUrl.startsWith('data:')) {
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
      window.open(receiptUrl, '_blank');
    }
  };

  // Ordenar y filtrar órdenes
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.createdAt || b.orderDate || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const currentOrders = sortedOrders.filter(order => 
    !['finalizado', 'cancelled', 'delivered'].includes(order.status)
  );

  const finishedOrders = sortedOrders.filter(order => 
    ['finalizado', 'delivered'].includes(order.status)
  );

  // Filtrar proveedores por búsqueda
  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(providerSearchTerm.toLowerCase())
  );



  // Handlers
  const handleOrderClick = (order: Order) => {
    const provider = providers.find(p => p.id === order.providerId);
    if (provider) {
      let normalizedPhone = provider.phone || '';
      normalizedPhone = normalizedPhone.replace(/[\s\-\(\)]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = `+${normalizedPhone}`;
      }
      
      const contact = {
        id: provider.id,
        name: provider.name,
        phone: normalizedPhone,
        providerId: provider.id,
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0
      };
      
      openGlobalChat(contact);
    }
  };

  const handleCreateOrder = async (orderData: any) => {
    try {
      setIsLoading(true);
      const newOrder = await addOrder(orderData, user.id);
      
      if (newOrder) {
        console.log('✅ Pedido creado:', newOrder.id);
        
        // 🔧 OPTIMIZACIÓN: Cerrar modal inmediatamente para mejor UX
        setIsCreateModalOpen(false);
        setSuggestedOrder(null);
        
        // Enviar notificación automática desde el servidor (en segundo plano)
        try {
          const response = await fetch('/api/orders/send-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order: newOrder,
              userId: user.id
            }),
          });
          
          if (!response.ok) {
            console.error('Error enviando notificación:', await response.text());
          } else {
            console.log('✅ Notificación enviada exitosamente');
          }
        } catch (error) {
          console.error('Error enviando notificación:', error);
        }
      }
    } catch (error) {
      console.error('Error creando pedido:', error);
      // 🔧 OPTIMIZACIÓN: Mantener modal abierto si hay error
      setIsCreateModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsEditModalOpen(true);
  };

  const handleSaveOrderEdit = async (orderId: string, updates: any) => {
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
            </div>
          </div>
        </div>

        {/* Layout principal con sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 max-w-full">
          {/* Sidebar con proveedores */}
          <div className="w-full lg:w-80 lg:flex-shrink-0">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Proveedores ({filteredProviders.length})
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar proveedor..."
                    value={providerSearchTerm}
                    onChange={(e) => setProviderSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredProviders.map((provider) => (
                  <div key={provider.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {provider.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {provider.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {provider.phone}
                          </p>
                        </div>
                        </div>
                      <div className="flex space-x-1">
                         <button
                          onClick={() => {
                            const contact = {
                              id: provider.id,
                              name: provider.name,
                              phone: provider.phone,
                              providerId: provider.id,
                              lastMessage: '',
                              lastMessageTime: new Date(),
                              unreadCount: 0
                            };
                            openGlobalChat(contact);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Chat"
                         >
                           <MessageSquare className="h-4 w-4" />
                         </button>
                         <button
                          onClick={() => {
                            setSuggestedOrder({
                              providerId: provider.id,
                              providerName: provider.name
                            });
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Crear pedido"
                        >
                          <Plus className="h-4 w-4" />
                         </button>
                      </div>
                    </div>
            </div>
                ))}
                </div>
              </div>

            
                        </div>

                     {/* Contenido principal */}
           <div className="flex-1 min-w-0">
                           {/* Órdenes sugeridas arriba */}
              <div className="bg-white shadow rounded-lg mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Órdenes Sugeridas
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Productos recomendados para reabastecer
                  </p>
                        </div>
                <div className="p-4">
                  <SuggestedOrders 
                    providers={providers}
                    stockItems={stockItems}
                    onCreateOrder={(orderData) => {
                      setSuggestedOrder(orderData);
                      setIsCreateModalOpen(true);
                    }}
                  />
                      </div>
                    </div>
                    
             {/* Órdenes actuales */}
             <div className="bg-white shadow rounded-lg mb-6">
               <div className="px-6 py-4 border-b border-gray-200">
                 <h2 className="text-xl font-semibold text-gray-900">
                   Órdenes Actuales ({currentOrders.length})
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
                          </div>
                 ) : (
                   currentOrders.map((order) => (
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
                             onClick={() => handleOrderClick(order)}
                             className="p-2 text-gray-400 hover:text-blue-600"
                             title="Chat con proveedor"
                           >
                             <MessageSquare className="h-4 w-4" />
                           </button>
                           <button
                             onClick={() => handleEditOrder(order)}
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
        </div>

        

            {/* Tabla completa de todas las órdenes */}
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Tabla Completa de Órdenes ({orders.length})
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Vista detallada de todos los pedidos con sus archivos y documentos
              </p>
            </div>
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Número
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.orderDate)}
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {order.orderNumber}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getProviderName(order.providerId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(order.status)}
                          <span className="ml-2 text-sm text-gray-900">
                            {order.status === 'pending' && 'Pendiente'}
                              {order.status === 'pending_confirmation' && 'Pendiente de Confirmación'}
                              {order.status === 'confirmed' && 'Confirmado'}
                            {order.status === 'enviado' && 'Enviado'}
                            {order.status === 'factura_recibida' && 'Factura Recibida'}
                            {order.status === 'pagado' && 'Pagado'}
                            {order.status === 'finalizado' && 'Finalizado'}
                              {order.status === 'cancelled' && 'Cancelado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {['factura_recibida','pagado','enviado','finalizado'].includes(order.status) 
                            ? `${order.totalAmount} ${order.currency}` 
                            : '-'}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOrderClick(order)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Chat con proveedor"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                              title="Editar orden"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
              </div>

        {/* Modales */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setSuggestedOrder(null);
          }}
          onSubmit={handleCreateOrder}
          suggestedOrder={suggestedOrder}
        providers={providers}
        stockItems={stockItems}
        isLoading={isLoading}
      />

       <EditOrderModal
         isOpen={isEditModalOpen}
         onClose={() => {
           setIsEditModalOpen(false);
           setEditingOrder(null);
         }}
          onSave={handleSaveOrderEdit}
          onCancel={handleCancelOrder}
         order={editingOrder}
         providers={providers}
                />


       </main>
     </div>
   );
 }
