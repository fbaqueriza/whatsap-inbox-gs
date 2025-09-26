'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useRouter } from 'next/navigation';
import { Order, Provider, StockItem } from '../../types';
import { DataProvider, useData } from '../../components/DataProvider';
import { ChatProvider } from '../../contexts/ChatContext';
import { GlobalChatProvider } from '../../contexts/GlobalChatContext';
import GlobalChatWrapper from '../../components/GlobalChatWrapper';
import { useRealtimeService } from '../../services/realtimeService';

// Lazy load components to reduce bundle size
const CreateOrderModal = React.lazy(() => import('../../components/CreateOrderModal'));
const EditOrderModal = React.lazy(() => import('../../components/EditOrderModal'));
const InvoiceManagementSystem = React.lazy(() => import('../../components/InvoiceManagementSystem'));

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
  Upload,
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
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  // Sync local orders with global data
  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  // Periodic refresh removed - using only realtime system as per user preference

  // 🔧 NUEVO: Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.provider-dropdown')) {
        setIsProviderDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Usar nuestro RealtimeService unificado
  const { orders: realtimeOrders, isConnected } = useRealtimeService();
  
  // Sincronizar con órdenes de tiempo real
  useEffect(() => {
    if (realtimeOrders && realtimeOrders.length > 0) {
      setLocalOrders(realtimeOrders);
    }
  }, [realtimeOrders]);
  
  const connectionStatus = isConnected ? 'connected' : 'disconnected';

  // Helper functions - usando constantes estandarizadas
  const getStatusIcon = (status: string) => {
    const statusIcons = {
      standby: <Clock className="h-4 w-4 text-yellow-500" />,
      enviado: <Send className="h-4 w-4 text-blue-500" />,
      esperando_factura: <FileText className="h-4 w-4 text-orange-500" />,
      pendiente_de_pago: <FileText className="h-4 w-4 text-purple-500" />,
      pagado: <CheckCircle className="h-4 w-4 text-green-500" />,
    };
    return statusIcons[status as keyof typeof statusIcons] || <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadgeClass = (status: string) => {
    const statusClasses = {
      standby: 'bg-yellow-100 text-yellow-800',
      enviado: 'bg-blue-100 text-blue-800',
      esperando_factura: 'bg-orange-100 text-orange-800',
      pendiente_de_pago: 'bg-purple-100 text-purple-800',
      pagado: 'bg-green-100 text-green-800',
    };
    return statusClasses[status as keyof typeof statusClasses] || 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (status: string) => {
    const statusTexts = {
      standby: 'Standby',
      enviado: 'Enviado',
      esperando_factura: 'Esperando Factura',
      pendiente_de_pago: 'Pendiente de Pago',
      pagado: 'Pagado',
    };
    return statusTexts[status as keyof typeof statusTexts] || status;
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
        // console.log('🔧 DEBUG - Iniciando envío de notificación...');
        // console.log('🔧 DEBUG - Orden a notificar:', newOrder);
        // console.log('🔧 DEBUG - Usuario ID:', user.id);
        
        try {
          // console.log('🔧 DEBUG - Llamando a /api/orders/send-notification...');
          const response = await fetch('/api/orders/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder, userId: user.id }),
          });
          
          // console.log('🔧 DEBUG - Respuesta recibida:', {
          //   status: response.status,
          //   statusText: response.statusText,
          //   ok: response.ok
          // });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error enviando notificación:', errorText);
          } else {
            console.log('✅ Notificación enviada exitosamente');
          }
        } catch (error) {
          console.error('❌ Error enviando notificación:', error);
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

  // 🔧 NUEVO: Manejador para abrir chat con proveedor
  const handleOrderClick = (order: Order) => {
    // console.log('🔧 DEBUG - Abriendo chat para orden:', order.id);
    
    // Buscar el proveedor de la orden
    const provider = providers.find(p => p.id === order.providerId);
    if (provider) {
      // console.log('🔧 DEBUG - Proveedor encontrado:', provider.name, provider.phone);
      
      // Abrir el chat global con el proveedor específico
      // Esto debería abrir el GlobalChatWrapper con el proveedor seleccionado
      window.dispatchEvent(new CustomEvent('openChatWithProvider', {
        detail: {
          providerId: provider.id,
          providerName: provider.name,
          providerPhone: provider.phone,
          orderId: order.id,
          orderNumber: order.orderNumber
        }
      }));
    } else {
      console.error('❌ Proveedor no encontrado para orden:', order.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Gestión de Órdenes</h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestiona pedidos pendientes, genera resúmenes de pagos y accede al repositorio de documentos por proveedor.
              </p>
            </div>
            <div className="flex flex-col items-end space-y-4">
              {/* 🔧 CORREGIDO: Título con letra más grande y alineado con el título principal */}
              <div className="text-right">
                <h2 className="text-2xl font-semibold text-gray-900">Nueva Orden</h2>
                <p className="text-sm text-gray-500 mt-1">Selecciona proveedor y crea orden</p>
        </div>

              {/* 🔧 CORREGIDO: Buscador y botón en la misma línea horizontal */}
              <div className="flex items-center space-x-3">
                <div className="relative provider-dropdown">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar proveedor..."
                    value={providerSearchTerm}
                    onChange={(e) => setProviderSearchTerm(e.target.value)}
                      onFocus={() => setIsProviderDropdownOpen(true)}
                      className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                  
                  {/* Dropdown de proveedores */}
                  {isProviderDropdownOpen && filteredProviders.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                {filteredProviders.map((provider) => (
                        <div
                          key={provider.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => {
                            setProviderSearchTerm(provider.name);
                            setIsProviderDropdownOpen(false);
                            setSuggestedOrder({
                              providerId: provider.id,
                              providerName: provider.name
                            });
                            setIsCreateModalOpen(true);
                          }}
                        >
                      <div className="flex items-center space-x-3">
                            <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                            {provider.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                          <p className="text-xs text-gray-500">{provider.phone}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
                  )}
                </div>
                
                {/* 🔧 CORREGIDO: Botón al lado del buscador */}
                    <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center justify-center w-10 h-10 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Nueva Orden"
                >
                  <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

        {/* 🔧 NUEVO: Sistema de Gestión de Pedidos */}
        <div className="mt-8">
          <InvoiceManagementSystem 
            onEdit={handleOrderClick}
            onUploadReceipt={(orderId, file) => console.log('Upload receipt:', orderId, file)}
          />
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
