"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { DataProvider, useData } from '../../components/DataProvider';
import { useRouter } from 'next/navigation';
import { Order, Provider, StockItem, OrderItem } from '../../types';
import { useChat } from '../../contexts/ChatContext';
import { useGlobalChat } from '../../contexts/GlobalChatContext';
import { OrderNotificationService } from '../../lib/orderNotificationService';
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
} from 'lucide-react';
import { Menu } from '@headlessui/react';
import SuggestedOrders from '../../components/SuggestedOrders';
import CreateOrderModal from '../../components/CreateOrderModal';
import ComprobanteButton from '../../components/ComprobanteButton';
import { useOrdersRealtime } from '../../hooks/useSupabaseRealtime';

export default function DashboardPageWrapper() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!authLoading && !user && typeof window !== 'undefined') {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);
  
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Cargando...</p></div></div>;
  }
  
  if (!user) {
    return null;
  }
  
  return (
    <DataProvider userEmail={user?.email ?? undefined} userId={user?.id}>
      <DashboardPage />
    </DataProvider>
  );
}

function DashboardPage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const { orders, providers, stockItems, setOrders, updateOrder, fetchAll } = useData();
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
    />
  );
}

function DashboardPageContent({
  orders,
  providers,
  stockItems,
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
}: {
  orders: Order[];
  providers: Provider[];
  stockItems: StockItem[];
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
}) {
  const { addOrder, updateOrder, fetchAll } = useData();
  // Chat hooks
  const { openChat, isChatOpen: contextIsChatOpen, closeChat } = useChat();
  const { openGlobalChat } = useGlobalChat();
  
  // Sincronizar el estado local con el contexto
  useEffect(() => {
    if (contextIsChatOpen !== isChatOpen) {
      setIsChatOpen(contextIsChatOpen);
    }
  }, [contextIsChatOpen, isChatOpen, setIsChatOpen]);
  
  // Ordenar órdenes por fecha descendente (created_at) - los más recientes primero
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.orderDate || 0);
    const dateB = new Date(b.createdAt || b.orderDate || 0);
    return dateB.getTime() - dateA.getTime();
  });
  const currentOrders = sortedOrders.filter(order => !['finalizado', 'cancelled', 'delivered'].includes(order.status));
  const finishedOrders = sortedOrders.filter(order => ['finalizado', 'delivered'].includes(order.status));
  const pendingOrders = orders.filter((order: Order) => order.status !== 'delivered').length;
  // Calculate upcoming orders (stock items with próxima orden within 7 days)
  const upcomingOrders = stockItems.filter((item: StockItem) => {
    if (!item.nextOrder) return false;
    const nextOrder = new Date(item.nextOrder);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return nextOrder <= weekFromNow;
  });
  const totalProviders = providers.length;
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
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  // Función getProviderName que usa el array providers del contexto
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
  const handleCreateOrder = async (orderData: {
    providerId: string;
    items: OrderItem[];
    notes: string;
  }) => {
    if (!user) return;
    const newOrder: Partial<Order> = {
      orderNumber: `ORD-${String(orders.length + 1).padStart(3, "0")}`,
      providerId: orderData.providerId,
      items: orderData.items,
      status: "pending",
      totalAmount: orderData.items.reduce((sum, item) => sum + item.total, 0),
      currency: "ARS",
      orderDate: new Date(),
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      invoiceNumber: "",
      bankInfo: {},
      receiptUrl: "",
      notes: orderData.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      user_id: user.id,
    };
    
    // Cerrar modal inmediatamente para mejor UX
    setIsCreateModalOpen(false);
    setSuggestedOrder(null);
    
    // Crear la orden en segundo plano
    const createdOrder = await addOrder(newOrder, user.id);
    
    // Enviar notificación al proveedor en segundo plano
    if (createdOrder) {
      const provider = providers.find(p => p.id === orderData.providerId);
      
      if (provider) {
        // Ejecutar en segundo plano sin bloquear la UI
        OrderNotificationService.sendOrderNotification({
          order: createdOrder as Order,
          provider: provider,
          items: orderData.items
        }).catch(error => {
          console.error('❌ Error enviando notificación de pedido:', error);
        });
      } else {
        console.error('❌ Proveedor no encontrado para ID:', orderData.providerId);
      }
    } else {
      console.error('❌ No se pudo crear la orden');
    }
    
    // Actualizar la lista de órdenes en segundo plano
    fetchAll().catch(error => {
      console.error('❌ Error actualizando lista de órdenes:', error);
    });
  };
  const handleSuggestedOrderCreate = (suggestedOrder: any) => {
    setSuggestedOrder(suggestedOrder);
    setSelectedProviderId((suggestedOrder?.suggestedProviders?.[0]?.id as string) ?? null);
    setIsCreateModalOpen(true);
  };

  // MANEJADORES REALTIME PARA ÓRDENES
  const handleNewOrder = useCallback((payload: any) => {
    console.log('🔄 Nueva orden recibida via Realtime:', payload);
    const newOrder = payload.new;
    
    if (newOrder) {
      setOrders(prev => {
        // Verificar si la orden ya existe
        const orderExists = prev.some(order => order.id === newOrder.id);
        if (orderExists) {
          return prev;
        }
        
        // Agregar la nueva orden
        return [...prev, newOrder];
      });
    }
  }, []);

  const handleOrderUpdate = useCallback((payload: any) => {
    console.log('🔄 Orden actualizada via Realtime:', payload);
    const updatedOrder = payload.new;
    
    if (updatedOrder) {
      setOrders(prev => 
        prev.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        )
      );
    }
  }, []);

  const handleOrderDelete = useCallback((payload: any) => {
    console.log('🔄 Orden eliminada via Realtime:', payload);
    const deletedOrder = payload.old;
    
    if (deletedOrder) {
      setOrders(prev => 
        prev.filter(order => order.id !== deletedOrder.id)
      );
    }
  }, []);

  // SUSCRIPCIÓN REALTIME PARA ÓRDENES - REMOVIDA, AHORA MANEJADA POR SERVICIO GLOBAL
  // useOrdersRealtime(
  //   handleNewOrder,
  //   handleOrderUpdate,
  //   handleOrderDelete
  // );

  const handleSendOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      console.log('DEBUG: Enviando pedido', orderId, 'estado actual:', order.status);
      await updateOrder({ ...order, status: 'enviado' });
      console.log('DEBUG: Pedido enviado, esperando factura...');
      
      // La actualización se manejará automáticamente via Realtime
      setTimeout(async () => {
        console.log('DEBUG: Simulando recepción de factura...');
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
          console.log('DEBUG: Actualizando pedido con factura y orden de pago:', orderWithInvoice);
          await updateOrder(orderWithInvoice);
          // La actualización se manejará automáticamente via Realtime
        } else {
          console.log('DEBUG: Pedido no encontrado o estado incorrecto:', updatedOrders.data?.status);
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
        
        console.log('DEBUG: Simulando subida de comprobante:', fileName);
        console.log('DEBUG: Data URL del comprobante creada');
        
        // Actualizar la orden con la data URL del comprobante
        const order = orders.find(o => o.id === orderId);
        if (order) {
          await updateOrder({ ...order, receiptUrl: dataUrl, status: 'pagado' });
          console.log('DEBUG: Orden actualizada con comprobante');
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

    const handleOrderClick = (order: Order) => {
    // Encontrar el proveedor correspondiente
    const provider = providers.find(p => p.id === order.providerId);
    
    if (provider) {
      // Normalizar el número de teléfono usando la función del contexto
      let normalizedPhone = provider.phone || '';
      
      // Remover espacios, guiones y paréntesis
      normalizedPhone = normalizedPhone.replace(/[\s\-\(\)]/g, '');
      
      // Agregar + si no tiene
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = `+${normalizedPhone}`;
      }
      
      // Asegurar que sea un número argentino válido
      if (!normalizedPhone.includes('+549')) {
        normalizedPhone = `+549${normalizedPhone.replace('+', '')}`;
      }
      
      // Crear contacto para el chat con el formato correcto
      const contact = {
        id: provider.id,
        name: provider.contactName 
          ? `${provider.name} - ${provider.contactName}`
          : provider.name,
        phone: normalizedPhone,
        providerId: provider.id,
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0
      };
      
      // Abrir el chat usando el contexto global
      openGlobalChat(contact);
      
      // También seleccionar el contacto en el chat local
      if (typeof window !== 'undefined') {
        // Usar un timeout para asegurar que el chat esté abierto
        setTimeout(() => {
          const event = new CustomEvent('selectContact', { 
            detail: { contact } 
          });
          window.dispatchEvent(event);
        }, 100);
      }
    }
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
          {/* Left Section: Pedidos pendientes + Pedidos recientes */}
          <div className="w-full">
            {/* Pedidos pendientes */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-6 mb-6 shadow">
              <h2 className="text-xl font-bold text-yellow-800 mb-4">Pedidos pendientes</h2>
              {currentOrders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">No hay pedidos pendientes</div>
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear nuevo pedido
                    </button>
                    <button
                      onClick={() => {
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
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat general
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="bg-white rounded-lg p-4 border border-yellow-200">
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
                            </div>
                            

                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          
                          {/* Botón de chat */}
                          <button
                            onClick={() => handleOrderClick(order)}
                            className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-gray-400"
                            title="Abrir chat con proveedor"
                          >
                            <MessageSquare className="h-3 w-3" />
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
                              href="/mock-factura.pdf"
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
                              onView={() => { if(order.receiptUrl) openReceipt(order.receiptUrl); }}
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
                       
                       {/* Orden de pago - solo en estado factura_recibida */}
                       {showPaymentOrder(order)}
                    </div>
                  ))}
                  {currentOrders.length > 5 && (
                    <div className="text-center">
                      <button
                        onClick={() => window.location.href = '/orders'}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver todos los pedidos ({currentOrders.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Divider */}
            <div className="my-6 border-t border-gray-200" />
            {/* Pedidos recientes */}
            <div className="bg-white rounded-lg p-6 shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Pedidos recientes</h2>
              {finishedOrders.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">No hay pedidos finalizados recientes</div>
                    </div>
              ) : (
                <div className="space-y-4">
                  {finishedOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(order.status)}
                            <div>
                            <div className="font-medium text-gray-900">
                              {getProviderName(order.providerId)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDate(order.createdAt || order.orderDate)}
                            </div>
                          </div>
                  </div>
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
                      {order.items && order.items.length > 0 && (
                        <div className="text-xs text-gray-600 mt-2">
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
                    </div>
                  ))}
                  {finishedOrders.length > 5 && (
                    <div className="text-center">
                      <button
                        onClick={() => window.location.href = '/orders'}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver todos los pedidos ({finishedOrders.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Right Section: Próximos pedidos + Providers table */}
          <div className="w-full">
            {/* Próximos pedidos */}
            <div className="bg-blue-100 border-l-8 border-blue-400 rounded-xl p-5 mb-6 shadow-lg">
              <h2 className="text-xl font-bold text-blue-900 mb-4">Próximos pedidos</h2>
              {user?.email === 'test@test.com' ? (
                <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                  {[
                    {
                      providerName: "Panadería Los Hermanos",
                      frecuenciaDias: 7,
                      ultimaOrden: "2025-07-15",
                      proximaOrden: "2025-07-22",
                      diasRestantes: 1,
                      lastMessage: "¿Van a necesitar el pan integral esta semana?"
                    },
                    {
                      providerName: "Distribuciones Verduras Martínez",
                      frecuenciaDias: 7,
                      ultimaOrden: "2025-07-14",
                      proximaOrden: "2025-07-21",
                      diasRestantes: 0,
                      lastMessage: "La última entrega fue el lunes. ¿Confirmamos para mañana?"
                    }
                  ]
                    .sort((a, b) => new Date(a.proximaOrden).getTime() - new Date(b.proximaOrden).getTime())
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className={`bg-white rounded-lg p-4 flex flex-col gap-1 shadow-sm border-l-4 ${item.diasRestantes <= 1 ? 'border-blue-500' : 'border-transparent'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">{item.providerName}</span>
                          <span className={`ml-2 text-sm ${item.diasRestantes <= 1 ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>{new Date(item.proximaOrden).toLocaleDateString()} ({item.diasRestantes === 0 ? 'Hoy' : `En ${item.diasRestantes} día${item.diasRestantes > 1 ? 's' : ''}`})</span>
        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate max-w-full" title={item.lastMessage}>{item.lastMessage.length > 80 ? item.lastMessage.slice(0, 80) + '…' : item.lastMessage}</div>
          </div>
                    ))}
              </div>
              ) : (
                (() => {
                  // Real upcoming orders for real users
                  const now = new Date();
                  const weekFromNow = new Date();
                  weekFromNow.setDate(now.getDate() + 7);
                  // Find providers with next order due in 7 days
                  const providerUpcoming = providers
                    .map((provider: Provider) => {
                      const nextOrderDates = stockItems
                        .filter((item: StockItem) => Array.isArray(item.associatedProviders) && item.associatedProviders.includes(provider.id) && item.nextOrder)
                        .map((item: StockItem) => item.nextOrder ? new Date(item.nextOrder as string | number | Date) : null)
                        .filter((d): d is Date => d !== null);
                      const nextExpectedOrderDate = nextOrderDates.length > 0 ? new Date(Math.min(...nextOrderDates.map((d: Date) => d.getTime()))) : null;
                      return { provider, nextExpectedOrderDate };
                    })
                    .filter(({ nextExpectedOrderDate }: { nextExpectedOrderDate: Date | null }) => nextExpectedOrderDate && nextExpectedOrderDate <= weekFromNow)
                    .sort((a: { nextExpectedOrderDate: Date | null }, b: { nextExpectedOrderDate: Date | null }) => (a.nextExpectedOrderDate as Date).getTime() - (b.nextExpectedOrderDate as Date).getTime());
                  if (providerUpcoming.length === 0) {
                    return <div className="text-gray-500 text-sm">No hay próximos pedidos en los próximos 7 días.</div>;
                  }
                  return (
                    <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                      {providerUpcoming.map(({ provider, nextExpectedOrderDate }: { provider: Provider, nextExpectedOrderDate: Date | null }, idx: number) => (
                        <div
                          key={provider.id}
                          className={`bg-white rounded-lg p-4 flex flex-col gap-1 shadow-sm border-l-4 ${(nextExpectedOrderDate && (nextExpectedOrderDate.getTime() - now.getTime()) < 2*24*60*60*1000) ? 'border-blue-500' : 'border-transparent'}`}
                        >
                      <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{provider.name}</span>
                            <span className={`ml-2 text-sm ${(nextExpectedOrderDate && (nextExpectedOrderDate.getTime() - now.getTime()) < 2*24*60*60*1000) ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>{nextExpectedOrderDate ? nextExpectedOrderDate.toLocaleDateString() : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
            {/* Providers Table */}
            <div className="bg-white rounded-lg p-4 shadow max-h-96 overflow-y-auto">
              <h2 className="text-md font-bold text-gray-800 mb-2">Proveedores</h2>
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última orden</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                    </tr>
                  </thead>
                <tbody>
                  {providers.map((provider: any) => {
                    // Find most recent order for this provider
                    const providerOrders = orders.filter((o: any) => o.providerId === provider.id);
                    const mostRecentOrder = providerOrders.length > 0 ? providerOrders.reduce((a: any, b: any) => new Date(a.orderDate) > new Date(b.orderDate) ? a : b) : null;
                    const lastOrderDate = mostRecentOrder ? new Date(mostRecentOrder.orderDate) : null;
                      return (
                        <tr key={provider.id} className="hover:bg-gray-50">
                        <td className="py-2 font-medium text-gray-900">{provider.name}</td>
                        <td className="py-2 text-xs text-gray-500">{lastOrderDate ? lastOrderDate.toLocaleDateString() : '-'}</td>
                        <td className="py-2 text-center">
                          <div className="flex justify-center space-x-1">
                          <button
                            onClick={() => handleProviderOrder(provider.id)}
                            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            title="Nuevo pedido"
                          >
                            <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                const normalizedPhone = provider.phone.startsWith('+') ? provider.phone : `+${provider.phone}`;
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
                              }}
                              className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              title="Chat con proveedor"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                          </td>
                        </tr>
                      );
                    })}
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
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  ¿Cómo usar el dashboard?
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Vista general:</strong> Aquí puedes ver todos tus pedidos, proveedores y stock en un solo lugar</li>
                    <li><strong>Pedidos pendientes:</strong> Gestiona pedidos que necesitan atención inmediata</li>
                    <li><strong>Pedidos recientes:</strong> Revisa el historial de pedidos finalizados</li>
                    <li><strong>Próximos pedidos:</strong> Ve qué pedidos están programados para los próximos días</li>
                    <li><strong>Proveedores:</strong> Accede rápidamente a tus proveedores y crea nuevos pedidos</li>
                    <li><strong>Chat integrado:</strong> Comunícate directamente con proveedores desde el dashboard</li>
                    <li><strong>Acciones rápidas:</strong> Todos los botones funcionan igual que en las páginas específicas</li>
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
        onClose={() => {
          setIsCreateModalOpen(false);
          setSuggestedOrder(null);
          setSelectedProviderId(null);
        }}
        onCreateOrder={handleCreateOrder}
        providers={providers}
        stockItems={stockItems}
        suggestedOrder={suggestedOrder}
        selectedProviderId={typeof selectedProviderId === 'string' ? selectedProviderId : null}
      />
    </div>
  );
}




