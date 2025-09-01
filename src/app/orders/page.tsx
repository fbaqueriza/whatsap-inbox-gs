'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useRouter } from 'next/navigation';
import { Order, Provider, StockItem } from '../../types';
import { DataProvider, useData } from '../../components/DataProvider';
import { ChatProvider } from '../../contexts/ChatContext';
import { GlobalChatProvider } from '../../contexts/GlobalChatContext';
import GlobalChatWrapper from '../../components/GlobalChatWrapper';
import { useOrdersFlowRealtime } from '../../hooks/useSupabaseRealtime';

// Lazy load components to reduce bundle size
const SuggestedOrders = React.lazy(() => import('../../components/SuggestedOrders'));
const CreateOrderModal = React.lazy(() => import('../../components/CreateOrderModal'));
const EditOrderModal = React.lazy(() => import('../../components/EditOrderModal'));
const OrdersModule = React.lazy(() => import('../../components/OrdersModule'));

// Icons import
import {
  Plus,
  ShoppingCart,
  Send,
  MessageSquare,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Edit,
  Search,
} from 'lucide-react';

// Error boundary component
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error al cargar la página
          </h2>
          <p className="text-gray-600 mb-4">
            Ha ocurrido un error inesperado. Por favor, recarga la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando componentes...</p>
        </div>
      </div>
    }>
      {children}
    </React.Suspense>
  );
};

// Main wrapper component
export default function OrdersPageWrapper() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();

  // Handle authentication
  if (!authLoading && !user) {
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ChatProvider>
        <GlobalChatProvider>
          <DataProvider userEmail={user?.email ?? undefined} userId={user?.id}>
            {user && <OrdersPage user={user} />}
          </DataProvider>
          <GlobalChatWrapper />
        </GlobalChatProvider>
      </ChatProvider>
    </ErrorBoundary>
  );
}

// Main orders page component
type OrdersPageProps = { user: any };

function OrdersPage({ user }: OrdersPageProps) {
  const { orders, providers, stockItems, addOrder, updateOrder, fetchAll } = useData();
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suggestedOrder, setSuggestedOrder] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [providerSearchTerm, setProviderSearchTerm] = useState('');

  // Sync local orders with global data
  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  // Periodic refresh as fallback
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchAll();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [fetchAll]);

  // Realtime handlers
  const handleNewOrder = useCallback((payload: any) => {
    const newOrder = payload.new;
    if (newOrder) {
      setLocalOrders((prevOrders: Order[]) => {
        const existingOrder = prevOrders.find((o: Order) => o.id === newOrder.id);
        if (existingOrder) {
          return prevOrders.map((o: Order) => o.id === newOrder.id ? { ...o, ...newOrder } : o);
        } else {
          return [newOrder, ...prevOrders];
        }
      });
    }
  }, []);

  const handleOrderUpdate = useCallback((payload: any) => {
    const updatedOrder = payload.new;
    if (updatedOrder) {
      setLocalOrders((prevOrders: Order[]) => 
        prevOrders.map((o: Order) => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
      );
    }
  }, []);

  const handleOrderDelete = useCallback((payload: any) => {
    const deletedOrder = payload.old;
    if (deletedOrder) {
      setLocalOrders((prevOrders: Order[]) => prevOrders.filter((o: Order) => o.id !== deletedOrder.id));
    }
  }, []);

  // Realtime subscription
  const { isSubscribed, connectionStatus } = useOrdersFlowRealtime(
    handleNewOrder,
    handleOrderUpdate,
    handleOrderDelete
  );

  // Helper functions
  const getStatusIcon = (status: string) => {
    const statusIcons = {
      pending: <Clock className="h-4 w-4 text-yellow-500" />,
      pending_confirmation: <AlertCircle className="h-4 w-4 text-orange-500" />,
      confirmed: <CheckCircle className="h-4 w-4 text-green-500" />,
      enviado: <Send className="h-4 w-4 text-blue-500" />,
      factura_recibida: <FileText className="h-4 w-4 text-purple-500" />,
      pagado: <CheckCircle className="h-4 w-4 text-green-500" />,
      finalizado: <CheckCircle className="h-4 w-4 text-green-500" />,
      cancelled: <X className="h-4 w-4 text-red-500" />,
    };
    return statusIcons[status as keyof typeof statusIcons] || <Clock className="h-4 w-4 text-gray-500" />;
  };

  const getStatusBadgeClass = (status: string) => {
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      pending_confirmation: 'bg-orange-100 text-orange-800',
      confirmed: 'bg-green-100 text-green-800',
      enviado: 'bg-blue-100 text-blue-800',
      factura_recibida: 'bg-purple-100 text-purple-800',
      pagado: 'bg-green-100 text-green-800',
      finalizado: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return statusClasses[status as keyof typeof statusClasses] || 'bg-gray-100 text-gray-800';
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

  // Filter and sort orders
  const sortedOrders = [...localOrders].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.createdAt || b.orderDate || 0);
    return dateB.getTime() - dateA.getTime();
  });

  const currentOrders = sortedOrders.filter(order => 
    !['finalizado', 'cancelled', 'delivered'].includes(order.status)
  );

  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(providerSearchTerm.toLowerCase())
  );

  // Event handlers
  const handleCreateOrder = async (orderData: any) => {
    try {
      setIsLoading(true);
      const newOrder = await addOrder(orderData, user.id);
      
      if (newOrder) {
        setIsCreateModalOpen(false);
        setSuggestedOrder(null);
        
        // Send notification in background
        try {
          const response = await fetch('/api/orders/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder, userId: user.id }),
          });
          
          if (!response.ok) {
            console.error('Error enviando notificación:', await response.text());
          }
        } catch (error) {
          console.error('Error enviando notificación:', error);
        }
      }
    } catch (error) {
      console.error('Error creando pedido:', error);
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
      const order = localOrders.find(o => o.id === orderId);
      if (!order) return;
      
      const updatedOrder = { ...order, ...updates, updatedAt: new Date() };
      await updateOrder(updatedOrder);
      setIsEditModalOpen(false);
      setEditingOrder(null);
    } catch (error) {
      console.error('Error actualizando pedido:', error);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const order = localOrders.find(o => o.id === orderId);
      if (order) {
        await updateOrder({ ...order, status: 'cancelled' });
      }
      setIsEditModalOpen(false);
      setEditingOrder(null);
    } catch (error) {
      console.error('Error cancelando pedido:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Órdenes</h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestión de pedidos y órdenes
                {connectionStatus === 'connected' && (
                  <span className="ml-2 text-green-600">• Tiempo Real Activo</span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Orden
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
                          <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                          <p className="text-xs text-gray-500">{provider.phone}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
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
            {/* Órdenes sugeridas */}
            <div className="bg-white shadow rounded-lg mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Órdenes Sugeridas</h2>
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
            <OrdersModule
              orders={currentOrders}
              providers={providers}
              onEditOrder={handleEditOrder}
              onCreateOrder={() => setIsCreateModalOpen(true)}
              showCreateButton={true}
              maxOrders={10}
              title="Órdenes Actuales"
              className="mb-6"
            />

            {/* Tabla completa de todas las órdenes */}
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Tabla Completa de Órdenes ({localOrders.length})
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
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
