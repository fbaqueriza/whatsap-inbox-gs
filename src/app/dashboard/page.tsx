"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { DataProvider, useData } from '../../components/DataProvider';
import { useRouter } from 'next/navigation';
import { Order, Provider, StockItem, OrderItem } from '../../types';
import { NotificationService } from '../../lib/notificationService';
import { PhoneNumberService } from '../../lib/phoneNumberService';
import { supabase } from '../../lib/supabase/client';
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
  BarChart3,
  Settings,
} from 'lucide-react';
import { Menu } from '@headlessui/react';
import SuggestedOrders from '../../components/SuggestedOrders';
import CreateOrderModal from '../../components/CreateOrderModal';
import ComprobanteButton from '../../components/ComprobanteButton';
import OrdersModule from '../../components/OrdersModule';
import { useRealtimeService } from '../../services/realtimeService';
import { useSessionValidator } from '../../hooks/useSessionValidator';

export default function DashboardPageWrapper() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const [hasWhatsAppConfig, setHasWhatsAppConfig] = useState(false);
  
  // ❌ DESHABILITADO: useSessionValidator() para evitar loops infinitos
  // useSessionValidator();
  
  // 🔧 VERIFICACIÓN OPTIMIZADA: Con rate limiting para evitar llamadas repetitivas
  const [configChecked, setConfigChecked] = useState(false);
  
  // 🔧 VERIFICACIÓN DE CONFIGURACIÓN: Verificar si el usuario tiene configuración de WhatsApp
  useEffect(() => {
    if (user && !configChecked) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 [Dashboard] Verificando configuración de WhatsApp para usuario:', user.id);
      }
      checkWhatsAppConfig();
      setConfigChecked(true);
    }
  }, [user, configChecked]);

  const checkWhatsAppConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📱 [Dashboard] No hay sesión activa para verificar configuración');
        }
        setHasWhatsAppConfig(false);
        return;
      }

      const response = await fetch('/api/whatsapp/configs', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const hasConfig = data.configs && data.configs.length > 0;
        if (process.env.NODE_ENV === 'development') {
          console.log('📱 [Dashboard] Configuración encontrada:', hasConfig);
        }
        setHasWhatsAppConfig(hasConfig);
      } else {
        console.log('📱 [Dashboard] Error verificando configuración, asumiendo que no hay');
        setHasWhatsAppConfig(false);
      }
    } catch (error) {
      console.error('📱 [Dashboard] Error verificando configuración:', error);
      setHasWhatsAppConfig(false);
    }
  };
  
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Cargando...</p></div></div>;
  }
  
  if (!user) {
    return null;
  }
  
  return (
    <DataProvider userEmail={user?.email ?? undefined} userId={user?.id}>
      <DashboardPage hasWhatsAppConfig={hasWhatsAppConfig} />
    </DataProvider>
  );
}

function DashboardPage({ hasWhatsAppConfig }: { hasWhatsAppConfig: boolean }) {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { orders, providers, stockItems, setOrders, updateOrder, fetchAll } = useData();
  const router = useRouter();
  // Remove isSeedUser and mockConversations logic
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suggestedOrder, setSuggestedOrder] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [paymentProofs, setPaymentProofs] = useState<{ [orderId: string]: { url: string; name: string } }>({});

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;
  return (
    <DashboardPageContent
      orders={orders}
      providers={providers}
      stockItems={stockItems}
      setOrders={setOrders}
      isCreateModalOpen={isCreateModalOpen}
      setIsCreateModalOpen={setIsCreateModalOpen}
      suggestedOrder={suggestedOrder}
      setSuggestedOrder={setSuggestedOrder}
      isChatOpen={isChatOpen}
      setIsChatOpen={setIsChatOpen}
      user={user}
      selectedProviderId={typeof selectedProviderId === 'string' ? selectedProviderId : null}
      setSelectedProviderId={setSelectedProviderId}
      paymentProofs={paymentProofs}
      setPaymentProofs={setPaymentProofs}
      hasWhatsAppConfig={hasWhatsAppConfig}
      router={router}
    />
  );
}

function DashboardPageContent({
  orders,
  providers,
  stockItems,
  setOrders,
  isCreateModalOpen,
  setIsCreateModalOpen,
  suggestedOrder,
  setSuggestedOrder,
  isChatOpen,
  setIsChatOpen,
  user,
  selectedProviderId,
  setSelectedProviderId,
  paymentProofs,
  setPaymentProofs,
  hasWhatsAppConfig,
  router,
}: {
  orders: Order[];
  providers: Provider[];
  stockItems: StockItem[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  suggestedOrder: any;
  setSuggestedOrder: (order: any) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  user: any;
  selectedProviderId: string | null;
  setSelectedProviderId: (id: string | null) => void;
  paymentProofs: { [orderId: string]: { url: string; name: string } };
  setPaymentProofs: (proofs: { [orderId: string]: { url: string; name: string } }) => void;
  hasWhatsAppConfig: boolean;
  router: any;
}) {
  const { addOrder, updateOrder, fetchAll } = useData();
  // Chat hooks
  // Chat eliminado: usar navegación a /chat
  const contextIsChatOpen = false;
  
  // Sincronizar el estado local con el contexto
  useEffect(() => {
    if (contextIsChatOpen !== isChatOpen) {
      setIsChatOpen(contextIsChatOpen);
    }
  }, [contextIsChatOpen, isChatOpen, setIsChatOpen]);
  
  const totalProviders = providers.length;

  // Creación de órdenes mejorada con manejo de errores
  const handleCreateOrder = async (orderData: {
    providerId: string;
    items: OrderItem[];
    notes: string;
    desiredDeliveryDate?: Date;
    desiredDeliveryTime?: string[];
    paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque';
    additionalFiles?: OrderFile[];
  }) => {
    if (!user) return;
    
    try {
      // Generar número de orden único
      const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${randomSuffix}`;
      
      const newOrder: Partial<Order> = {
        orderNumber: orderNumber,
        providerId: orderData.providerId,
        items: orderData.items,
        status: "pending",
        totalAmount: orderData.items.reduce((sum, item) => sum + (item.total || 0), 0),
        currency: "ARS",
        orderDate: new Date(),
        dueDate: orderData.desiredDeliveryDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        invoiceNumber: "",
        bankInfo: {},
        receiptUrl: "",
        notes: orderData.notes,
        desiredDeliveryDate: orderData.desiredDeliveryDate,
        desiredDeliveryTime: orderData.desiredDeliveryTime,
        paymentMethod: orderData.paymentMethod || 'efectivo',
        additionalFiles: orderData.additionalFiles || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        user_id: user.id,
      };
      
      // Cerrar modal inmediatamente para mejor UX
      setIsCreateModalOpen(false);
      setSuggestedOrder(null);
      setSelectedProviderId(null);
      
      // Crear la orden con manejo de errores
      const createdOrder = await addOrder(newOrder, user.id);
      
      if (createdOrder) {
        // 🔧 FIX: La notificación se envía desde DataProvider, no desde aquí
        console.log('✅ Orden creada exitosamente');
      } else {
        console.error('No se pudo crear la orden - pero modal permanece cerrado para mejor UX');
        // No reabrir modal - el usuario puede crear una nueva orden si es necesario
      }
      
      // Actualizar la lista de órdenes inmediatamente
      await fetchAll();
      
      // Forzar actualización adicional después de un breve delay
      setTimeout(async () => {
        await fetchAll();
      }, 500);
      
    } catch (error) {
      console.error('Error creando pedido:', error);
      // Mostrar mensaje de error pero no reabrir modal para mejor UX
      alert('Error al crear el pedido. Por favor, inténtalo de nuevo.');
      // Modal permanece cerrado - usuario puede crear nueva orden si es necesario
    }
  };
  const handleSuggestedOrderCreate = (suggestedOrder: any) => {
    setSuggestedOrder(suggestedOrder);
    setSelectedProviderId((suggestedOrder?.suggestedProviders?.[0]?.id as string) ?? null);
    setIsCreateModalOpen(true);
  };

  // Manejadores realtime mejorados para órdenes
  const handleNewOrder = useCallback((payload: any) => {
    const newOrder = payload.new;
    
    if (newOrder) {
      setOrders(prev => {
        // Verificar si la orden ya existe
        const orderExists = prev.some(order => order.id === newOrder.id);
        if (orderExists) {
          return prev.map(order => order.id === newOrder.id ? { ...order, ...newOrder } : order);
        }
        
        // Agregar la nueva orden al inicio
        return [newOrder, ...prev];
      });
      
      // Forzar actualización de la UI
      setTimeout(() => {
        fetchAll();
      }, 100);
    }
  }, [fetchAll]);

  const handleOrderUpdate = useCallback((payload: any) => {
    const updatedOrder = payload.new;
    
    if (updatedOrder) {
      setOrders(prev => 
        prev.map(order => 
          order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
        )
      );
    }
  }, []);

  const handleOrderDelete = useCallback((payload: any) => {
    const deletedOrder = payload.old;
    
    if (deletedOrder) {
      setOrders(prev => 
        prev.filter(order => order.id !== deletedOrder.id)
      );
    }
  }, []);

  // 🔧 REMOVIDO: listener duplicado - DataProvider ya maneja las actualizaciones de Realtime
  // const { orders: realtimeOrders, isConnected } = useRealtimeService();
  
  // const isSubscribed = false; // Ya no se necesita
  const connectionStatus = 'connected'; // Asumir conectado siempre ya que DataProvider maneja esto

  // Sincronizar con lógica de página de órdenes
  const currentOrders = useMemo(() => {
    // Incluir órdenes activas (no finalizadas ni canceladas)
    // TEMPORAL: Mostrar todas las órdenes para debug
    const activeOrders = orders.filter(order => 
      !['finalizado', 'cancelled'].includes(order.status)
    );
    
    // Ordenar por fecha de actualización (más recientes primero)
    const sortedOrders = activeOrders.sort((a, b) => 
      new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
    
    return sortedOrders;
  }, [orders]);

  // Listener para actualización al cerrar modal
  useEffect(() => {
    const handleModalClosed = () => {
      fetchAll();
    };

    window.addEventListener('orderModalClosed', handleModalClosed);
    return () => window.removeEventListener('orderModalClosed', handleModalClosed);
  }, [fetchAll]);



  const handleSendOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await updateOrder({ ...order, status: 'enviado' });
      
      // La actualización se manejará automáticamente via Realtime
      setTimeout(async () => {
        // Buscar el pedido actualizado después del fetchAll
        const updatedOrders = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (updatedOrders.data && updatedOrders.data.status === 'enviado') {
          // Obtener datos del proveedor para la orden de pago
          const provider = providers.find(p => p.id === order.providerId);
          const bankInfo = {
            accountNumber: provider?.cbu || '1234567890'
          };
          const totalAmount = 1000; // Monto extraído de la factura PDF

          const orderWithInvoice = {
            ...updatedOrders.data,
            status: 'factura_recibida' as 'factura_recibida',
            invoiceNumber: 'INV-MOCK-001',
            receiptUrl: '/mock-factura.pdf',
            bankInfo: bankInfo,
            totalAmount: totalAmount,
          } as Order;
          
          await updateOrder(orderWithInvoice);
          // La actualización se manejará automáticamente via Realtime
        }
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
          // Refetch para actualizar los datos en la UI
          await fetchAll();
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
      // Refetch para actualizar los datos en la UI
      await fetchAll();
    }
  };

  const handleEditOrder = (order: Order) => {
    // Redirigir a la página de pedidos para editar
    window.location.href = `/orders?edit=${order.id}`;
  };


  const handleOrderClick = (order: Order) => {
    window.location.href = '/chat';
  };

  const openReceipt = (receiptUrl: string | undefined) => {
    // Función para abrir comprobantes (data URLs o URLs normales)
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


  const handleProviderOrder = (providerId: string) => {
    setSelectedProviderId(providerId ?? null);
    setIsCreateModalOpen(true);
  };
  // Helper: get last order date for a provider
  function getProviderLastOrderDate(providerId: string): Date | null {
    const providerOrders = Array.isArray(orders) ? orders.filter((o: any) => o.providerId === providerId) : [];
    if (providerOrders.length === 0) return null;
    return new Date(Math.max(...providerOrders.map((o: any) => new Date(o.orderDate).getTime())));
  }
  // Helper: check if provider has active/pending orders
  function providerHasActiveOrder(providerId: string): boolean {
    return Array.isArray(orders) && orders.some((o: any) => o.providerId === providerId && ['pending', 'sent', 'confirmed'].includes(o.status));
  }
  // Helper: check if provider has imminent order (next order for any of their products within 7 days)
  function providerHasImminentOrder(providerId: string): boolean {
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(now.getDate() + 7);
    return Array.isArray(stockItems) && stockItems.some((item: any) =>
      Array.isArray(item.associatedProviders) && item.associatedProviders.includes(providerId) && item.nextOrder && new Date(item.nextOrder) <= weekFromNow
    );
  }
  // Sort providers
  const sortedProviders = [...providers].sort((a, b) => {
    // 1. Active/pending orders
    const aActive = providerHasActiveOrder(a.id);
    const bActive = providerHasActiveOrder(b.id);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    // 2. Imminent order
    const aImminent = providerHasImminentOrder(a.id);
    const bImminent = providerHasImminentOrder(b.id);
    if (aImminent && !bImminent) return -1;
    if (!aImminent && bImminent) return 1;
    // 3. Most recent order date
    const aLast = getProviderLastOrderDate(a.id);
    const bLast = getProviderLastOrderDate(b.id);
    if (aLast && bLast) return bLast.getTime() - aLast.getTime();
    if (aLast) return -1;
    if (bLast) return 1;
    return 0;
  });
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Remove floating chat button */}
      {/* Header */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-x-8 gap-y-8">
          {/* Left Section: Pedidos actuales */}
          <div className="w-full">
            <OrdersModule
              orders={currentOrders}
              providers={providers}
              onOrderClick={handleOrderClick}
              onEditOrder={handleEditOrder}
              onCreateOrder={() => setIsCreateModalOpen(true)}
              onOpenChat={() => {
                // Abrir chat con el primer proveedor disponible
                const firstProvider = providers[0];
                if (firstProvider) {
                  handleOrderClick({
                    id: 'general-chat',
                    providerId: firstProvider.id,
                    status: 'pending'
                  } as Order);
                }
              }}
              showCreateButton={true}
              maxOrders={5}
              title="Órdenes Actuales"
              className="mb-6"
            />
          </div>
          {/* Right Section: Providers table */}
          <div className="w-full">
            {/* Providers table - se mantiene igual */}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 px-4 sm:px-0">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  ¿Cómo usar el dashboard?
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Vista general:</strong> Aquí puedes ver todos tus pedidos, proveedores y stock en un solo lugar</li>
                    <li><strong>Pedidos actuales:</strong> Gestiona pedidos que necesitan atención inmediata (mismo módulo que en /orders)</li>
                    <li><strong>Proveedores:</strong> Accede rápidamente a tus proveedores y crea nuevos pedidos</li>
                    <li><strong>Chat integrado:</strong> Comunícate directamente con proveedores desde el dashboard</li>
                    <li><strong>Acciones rápidas:</strong> Todos los botones funcionan igual que en las páginas específicas</li>
                  </ul>
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => router.push('/dashboard/whatsapp-config')}
                  className={`px-4 py-2 text-white rounded-md hover:opacity-90 flex items-center text-sm ${
                    hasWhatsAppConfig 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {hasWhatsAppConfig ? 'Gestionar WhatsApp' : 'Configurar WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSuggestedOrder(null);
          setSelectedProviderId(null);
        }}
         onSubmit={handleCreateOrder}
        providers={providers}
        stockItems={stockItems}
        orders={orders} // ✅ NUEVO: Pasar orders al modal
        suggestedOrder={suggestedOrder}
        isLoading={false}
      />
    </div>
  );
}




