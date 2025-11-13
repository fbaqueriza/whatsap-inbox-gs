import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Order, Provider, StockItem, WhatsAppMessage } from '../types';
import { supabase } from '../lib/supabase/client';
import { useRealtimeService } from '../services/realtimeService';
import type { SupabaseClient } from '@supabase/supabase-js';
interface DataContextType {
  orders: Order[];
  providers: Provider[];
  stockItems: StockItem[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  addOrder: (order: Partial<Order>, user_id: string) => Promise<Order | null>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string, user_id: string) => Promise<void>;
  addProvider: (provider: Partial<Provider> | Partial<Provider>[], user_id: string, batch?: boolean) => Promise<any>;
  updateProvider: (provider: Provider) => Promise<void>;
  deleteProvider: (id: string | string[], user_id: string, batch?: boolean, forceDelete?: boolean) => Promise<void>;
  addStockItem: (item: Partial<StockItem> | Partial<StockItem>[], user_id: string, batch?: boolean) => Promise<void>;
  updateStockItem: (item: StockItem) => Promise<void>;
  deleteStockItem: (id: string | string[], user_id: string, batch?: boolean) => Promise<void>;
  setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}
const DataContext = createContext<DataContextType | undefined>(undefined);
export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
};
// Función para mapear de snake_case a camelCase
function mapStockItemFromDb(item: any): StockItem {
  return {
    ...item,
    productName: item.product_name || '',
    category: item.category || 'Other',
    quantity: item.quantity || 0,
    unit: item.unit || '',
    lastPriceNet: item.last_price_net || 0,
    restockFrequency: item.restock_frequency || 'weekly',
    associatedProviders: Array.isArray(item.associated_providers) ? item.associated_providers : [],
    preferredProvider: item.preferred_provider || '',
    lastOrdered: item.last_ordered ? new Date(item.last_ordered) : null,
    nextOrder: item.next_order ? new Date(item.next_order) : null,
    createdAt: item.created_at ? new Date(item.created_at) : new Date(),
    updatedAt: item.updated_at ? new Date(item.updated_at) : new Date(),
    id: item.id,
    user_id: item.user_id,
  };
}
// 🔧 SOLUCIÓN PERMANENTE: Función para mapear Order de snake_case a camelCase
// 🔧 NUEVO: Función para normalizar estados
import { normalizeOrderStatus, ORDER_STATUS } from '../lib/orderConstants';

function normalizeStatus(status: string): string {
  return normalizeOrderStatus(status);
}

function mapOrderFromDb(order: any): Order {
  return {
    ...order,
    providerId: order.provider_id,
    orderNumber: order.order_number, // Usar el valor real de la base de datos
    totalAmount: order.total_amount || 0,
    orderDate: order.order_date ? new Date(order.order_date) : new Date(),
    dueDate: order.due_date ? new Date(order.due_date) : undefined,
    invoiceNumber: order.invoice_number,
    bankInfo: order.bank_info,
    receiptUrl: order.receipt_url,
    invoiceFileUrl: order.invoice_file_url || order.receipt_url || undefined,
    paymentReceiptUrl: order.payment_receipt_url || undefined,
    // 🔧 CORRECCIÓN: Usar estado directo de la BD (ya está normalizado)
    status: (order.status || 'standby') as Order['status'],
    // 🔧 NUEVAS COLUMNAS NATIVAS: Mapear directamente desde la BD
    desiredDeliveryDate: order.desired_delivery_date ? new Date(order.desired_delivery_date) : undefined,
    desiredDeliveryTime: order.desired_delivery_time || undefined,
    paymentMethod: (order.payment_method as 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque') || 'efectivo',
    additionalFiles: order.additional_files || undefined,
    createdAt: order.created_at ? new Date(order.created_at) : new Date(),
    updatedAt: order.updated_at ? new Date(order.updated_at) : new Date(),
    id: order.id,
    user_id: order.user_id,
  };
}
// Función para mapear Provider de snake_case a camelCase
function mapProviderFromDb(provider: any): Provider {
  return {
    ...provider,
    contactName: provider.contact_name || '', // 🔧 CORRECCIÓN: Mapear desde contact_name de la BD con fallback
    notes: provider.notes || '', // 🔧 CORRECCIÓN: Mapear notas del proveedor desde la BD
    razonSocial: provider.razon_social || '',
    cuitCuil: provider.cuit_cuil || '',
    defaultDeliveryDays: provider.default_delivery_days || [],
    defaultDeliveryTime: provider.default_delivery_time || [],
    defaultPaymentMethod: provider.default_payment_method || 'efectivo',
    paymentTermDays: provider.payment_term_days || provider.paymentTermDays || null, // Plazo de pago en días
    autoOrderFlowEnabled: provider.auto_order_flow_enabled !== undefined ? provider.auto_order_flow_enabled : true, // Por defecto true
    catalogs: provider.catalogs || [],
    createdAt: provider.created_at,
    updatedAt: provider.updated_at,
    id: provider.id,
    user_id: provider.user_id,
  };
}
// 🔧 FUNCIÓN DE VERIFICACIÓN: Para debug de datos (solo en desarrollo)
function verifyOrderData(order: any, source: string) {
  // 🔧 LIMPIEZA: Comentar logs excesivos
  // if (process.env.NODE_ENV === 'development') {
  //   console.log(`🔧 VERIFICACIÓN - ${source}:`, order);
  // }
}
export const DataProvider: React.FC<{ userEmail?: string; userId?: string; children: React.ReactNode }> = ({ userEmail, userId, children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  // 🔧 NUEVO: Conectar con RealtimeService para actualizaciones en tiempo real
  const realtimeService = useRealtimeService();
  
  // 🔧 CORREGIDO: Usar el currentUserId del RealtimeService en lugar del local
  const currentUserId = realtimeService.currentUserId || userId || null;
  // Fetch providers
  const fetchProviders = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error cargando proveedores:', error);
        setProviders([]);
        return;
      }
      setProviders(data?.map(mapProviderFromDb) || []);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
      setProviders([]);
    }
  }, [currentUserId]);
  // Fetch all data for the user con optimización para items del proveedor
  const fetchAll = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    setLoading(true);
    try {
      // 🔧 NUEVO: Usar endpoints de API del servidor para evitar problemas de RLS
      const [providersResponse, stockResponse, ordersResponse] = await Promise.all([
        fetch(`/api/data/providers?user_id=${currentUserId}`),
        supabase.from('stock').select(`
          *,
          associated_providers
        `).eq('user_id', currentUserId).order('preferred_provider', { ascending: true }).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false })
      ]);

      // Procesar proveedores desde la API
      if (providersResponse.ok) {
        const providersData = await providersResponse.json();
        if (providersData.success) {
          const mappedProviders = (providersData.providers || []).map(mapProviderFromDb);
          setProviders(mappedProviders);
        } else {
          console.error('❌ Error fetching providers from API:', providersData.error);
        }
      } else {
        console.error('❌ Error fetching providers from API:', providersResponse.status);
      }

      // Procesar stock items (mantener acceso directo por ahora)
      const { data: stocks, error: stockError } = await stockResponse;
      if (stockError) console.error('❌ Error fetching stock:', stockError);
      
      // 🔧 OPTIMIZACIÓN: Validar y limpiar datos de stock items
      const validatedStockItems = (stocks || []).map(item => ({
        ...mapStockItemFromDb(item),
        associated_providers: Array.isArray(item.associated_providers) 
          ? item.associated_providers 
          : []
      }));
      setStockItems(validatedStockItems);

      // Procesar órdenes
      const { data: ordersData, error: ordersError } = ordersResponse;
      let paymentReceiptsMap: Record<string, string> = {};
      let invoiceDocsMap: Record<string, string> = {};

      try {
        const { data: receiptsData, error: receiptsError } = await supabase
          .from('payment_receipts')
          .select('order_id, file_url')
          .eq('user_id', currentUserId);

        if (receiptsError) {
          console.warn('⚠️ [DataProvider] Error obteniendo payment_receipts:', receiptsError);
        } else if (receiptsData) {
          paymentReceiptsMap = receiptsData.reduce((acc, receipt) => {
            if (receipt.order_id && receipt.file_url && !acc[receipt.order_id]) {
              acc[receipt.order_id] = receipt.file_url;
            }
            return acc;
          }, {} as Record<string, string>);
        }
      } catch (receiptsCatch) {
        console.warn('⚠️ [DataProvider] Error inesperado obteniendo payment_receipts:', receiptsCatch);
      }

      try {
        const orderIds = (ordersData || []).map(order => order.id).filter(Boolean);
        if (orderIds.length > 0) {
          const { data: invoiceDocs, error: invoiceDocsError } = await supabase
            .from('documents')
            .select('order_id, file_url, file_type')
            .eq('user_id', currentUserId)
            .in('order_id', orderIds);

          if (invoiceDocsError) {
            console.warn('⚠️ [DataProvider] Error obteniendo documents para facturas:', invoiceDocsError);
          } else if (invoiceDocs) {
            invoiceDocsMap = invoiceDocs.reduce((acc, doc) => {
              if (!doc.order_id || !doc.file_url) return acc;
              const fileType = typeof (doc as any).file_type === 'string' ? (doc as any).file_type.toLowerCase() : '';
              const isInvoice = fileType.includes('factura') || fileType.includes('invoice');

              if (isInvoice && !acc[doc.order_id]) {
                acc[doc.order_id] = doc.file_url;
              }
              return acc;
            }, {} as Record<string, string>);
          }
        }
      } catch (invoiceDocsCatch) {
        console.warn('⚠️ [DataProvider] Error inesperado obteniendo documentos de factura:', invoiceDocsCatch);
      }

      if (ordersError) {
        console.error('❌ Error fetching orders:', ordersError);
        setOrders([]);
      } else {
        const validatedOrders = (ordersData || []).map(order => {
          const mapped = mapOrderFromDb(order);
          if (!mapped.paymentReceiptUrl && paymentReceiptsMap[order.id]) {
            mapped.paymentReceiptUrl = paymentReceiptsMap[order.id];
          }
          if (invoiceDocsMap[order.id]) {
            mapped.invoiceFileUrl = invoiceDocsMap[order.id];
          }
          if (!mapped.invoiceFileUrl) {
            mapped.invoiceFileUrl = mapped.receiptUrl;
          }
          return mapped;
        });
        setOrders(validatedOrders);
      }
      
    } catch (error) {
      console.error('❌ Error in fetchAll:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);
  useEffect(() => {
    if (currentUserId) {
      fetchAll();
    } else {
    }
  }, [currentUserId]); // Solo depende de currentUserId, no de fetchAll

  // 🔧 NUEVO: Escuchar actualizaciones de órdenes en tiempo real
  useEffect(() => {
    if (!currentUserId) {
      console.warn('⚠️ [DataProvider] No hay currentUserId, no se puede suscribir a actualizaciones');
      return;
    }

    const unsubscribeOrderUpdates = realtimeService.addOrderListener((updatedOrder) => {
      // Actualizar solo la orden específica en lugar de recargar todas
      setOrders(prevOrders => {
        const existingOrderIndex = prevOrders.findIndex(order => order.id === updatedOrder.id);
        
        if (existingOrderIndex >= 0) {
          // Actualizar orden existente
          const updatedOrders = [...prevOrders];
          const mergedOrder = {
            ...updatedOrders[existingOrderIndex],
            ...updatedOrder,
          } as Order;
          if (updatedOrder.updatedAt && !(updatedOrder.updatedAt instanceof Date)) {
            mergedOrder.updatedAt = new Date(updatedOrder.updatedAt);
          }
          if (updatedOrder.status) {
            mergedOrder.status = updatedOrder.status as Order['status'];
          }
          if (!mergedOrder.invoiceFileUrl && updatedOrder.invoiceFileUrl) {
            mergedOrder.invoiceFileUrl = updatedOrder.invoiceFileUrl;
          }
          if (!mergedOrder.paymentReceiptUrl && updatedOrder.paymentReceiptUrl) {
            mergedOrder.paymentReceiptUrl = updatedOrder.paymentReceiptUrl;
          }
          updatedOrders[existingOrderIndex] = mergedOrder;
          return updatedOrders;
        } else {
          // Verificar que no sea duplicado antes de agregar
          const exists = prevOrders.some(o => o.id === updatedOrder.id);
          if (exists) {
            return prevOrders;
          }
          const newOrder = {
            ...updatedOrder,
            status: (updatedOrder.status || 'standby') as Order['status'],
          } as Order;
          if (updatedOrder.updatedAt && !(updatedOrder.updatedAt instanceof Date)) {
            newOrder.updatedAt = new Date(updatedOrder.updatedAt);
          }
          return [newOrder, ...prevOrders];
        }
      });
    });

    return () => {
      unsubscribeOrderUpdates();
    };
  }, [currentUserId]);
  // CRUD: Orders
  const addOrder = useCallback(async (order: Partial<Order>, user_id: string) => {
    try {
      
      // Generar número de orden único
      const timestamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${randomSuffix}`;
      
      // Preparar datos de la orden para el servicio unificado
      // 🔧 FIX: Convertir fechas a ISO string si son objetos Date
      
      // ✅ CORRECCIÓN: Verificar que dueDate se está pasando correctamente
      if (order.dueDate) {
        console.log('🔍 [DataProvider] dueDate recibido:', {
          dueDate: order.dueDate,
          type: typeof order.dueDate,
          isDate: order.dueDate instanceof Date,
          value: order.dueDate instanceof Date ? order.dueDate.toISOString() : order.dueDate
        });
      }
      
      const orderData = {
        ...order,
        id: crypto.randomUUID(), // Generar ID único para la orden
        orderNumber: orderNumber,
        status: 'standby', // Estado inicial según el nuevo flujo
        totalAmount: order.totalAmount || 0,
        currency: order.currency || 'ARS',
        orderDate: order.orderDate || new Date(),
        // ✅ CORRECCIÓN: Usar dueDate del order si existe, sino calcular desde el proveedor
        // No usar fallback genérico de 5 días, ya que se calcula en dashboard/page.tsx
        dueDate: order.dueDate || undefined,
        desiredDeliveryDate: order.desiredDeliveryDate instanceof Date 
          ? order.desiredDeliveryDate.toISOString() 
          : order.desiredDeliveryDate || null,
        desiredDeliveryTime: order.desiredDeliveryTime || null,
        paymentMethod: order.paymentMethod || 'efectivo',
        additionalFiles: order.additionalFiles || [],
        notes: order.notes || ''
      };
      
      // 🚀 NUEVO: Llamar directamente a la API del servidor
      const response = await fetch('/api/orders/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: orderData,
          userId: user_id
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.orderId) {
        // Obtener la orden creada desde la base de datos
        const { data: createdOrder, error: fetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', result.orderId)
          .single();
        
        if (fetchError) {
          console.error('Error obteniendo orden creada:', fetchError);
          throw fetchError;
        }
        
        const mappedOrder = mapOrderFromDb(createdOrder);

        // Marcar pendiente de aprobación si aplica (para banner en chat/config)
        try {
          if (result?.pendingApproval) {
            if (typeof window !== 'undefined') {
              localStorage.setItem('wa_display_name_pending', '1');
              localStorage.removeItem('wa_display_name_pending_dismissed');
            }
          } else if (result?.message?.includes('notificación enviada') || (result?.pendingApproval === false && result?.success)) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('wa_display_name_pending');
            }
          }
        } catch {}
        
        // 🔧 FIX: Verificar si la orden ya existe antes de agregar para evitar duplicados
        setOrders(prevOrders => {
          const exists = prevOrders.some(o => o.id === mappedOrder.id);
          if (exists) {
            console.log('⚠️ [DataProvider] Orden ya existe en estado local, actualizando en lugar de duplicar:', mappedOrder.id);
            // Actualizar la orden existente en lugar de agregar duplicado
            return prevOrders.map(o => o.id === mappedOrder.id ? mappedOrder : o);
          }
          // Agregar al inicio (orden más reciente primero)
          return [mappedOrder, ...prevOrders];
        });
        return mappedOrder;
      } else {
        throw new Error(result.errors?.join(', ') || 'Error creando orden');
      }
    } catch (error) {
      console.error('Error in addOrder:', error);
      throw error;
    }
  }, []);
  const updateOrder = useCallback(async (order: Order) => {
    try {
      // 🔧 SOLUCIÓN PERMANENTE: Mapear campos a snake_case usando columnas nativas
      const snakeCaseOrder = {
        provider_id: (order as any).providerId,
        user_id: order.user_id,
        items: order.items,
        status: order.status,
        total_amount: (order as any).totalAmount,
        currency: order.currency,
        order_date: (order as any).orderDate,
        due_date: (order as any).dueDate,
        invoice_number: (order as any).invoiceNumber,
        bank_info: (order as any).bankInfo,
        receipt_url: (order as any).receiptUrl,
        invoice_file_url: order.invoiceFileUrl || order.receiptUrl || null,
        payment_receipt_url: order.paymentReceiptUrl || null,
        notes: order.notes,
        // 🔧 NUEVAS COLUMNAS NATIVAS para campos del modal
        desired_delivery_date: order.desiredDeliveryDate ? order.desiredDeliveryDate.toISOString() : null,
        desired_delivery_time: order.desiredDeliveryTime && order.desiredDeliveryTime.length > 0 ? order.desiredDeliveryTime : null,
        payment_method: order.paymentMethod || 'efectivo',
        additional_files: order.additionalFiles && order.additionalFiles.length > 0 ? order.additionalFiles : null,
        created_at: (order as any).createdAt,
        updated_at: new Date().toISOString(), // 🔧 MEJORA: Actualizar timestamp
      };
      const { error } = await supabase.from('orders').update(snakeCaseOrder).eq('id', order.id);
      if (error) {
        console.error('Error updating order:', error);
        throw error;
      }
      // 🔧 OPTIMIZACIÓN: Actualizar localmente sin fetchAll completo
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === order.id 
            ? { 
                ...o, 
                ...order, 
                invoiceFileUrl: order.invoiceFileUrl || o.invoiceFileUrl || order.receiptUrl || o.receiptUrl,
                paymentReceiptUrl: order.paymentReceiptUrl || o.paymentReceiptUrl, 
                updatedAt: new Date() 
              } 
            : o
        )
      );
    } catch (error) {
      console.error('Error in updateOrder:', error);
      throw error;
    }
  }, []);
  const deleteOrder = useCallback(async (id: string, user_id: string) => {
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id).eq('user_id', user_id);
      if (error) {
        console.error('Error deleting order:', error);
        throw error;
      }
      await fetchAll();
    } catch (error) {
      console.error('Error in deleteOrder:', error);
      throw error;
    }
  }, [fetchAll]);
  // CRUD: Providers
  // Permitir batch insert
  const addProvider = useCallback(async (providerOrProviders: Partial<Provider>|Partial<Provider>[], user_id: string, batch = false) => {
    try {
      console.log('addProvider called with:', { providerOrProviders, user_id, batch });
      if (batch && Array.isArray(providerOrProviders)) {
        const result = await supabase.from('providers').insert(providerOrProviders);
        if (result.error) {
          console.error('Error adding providers (batch):', result.error);
          throw result.error;
        }
        // Agregar las nuevas filas al principio en lugar de recargar todo
        if (result.data && Array.isArray(result.data) && (result.data as any[]).length > 0) {
          const newProviders = (result.data as any[]).map(mapProviderFromDb);
          console.log('Adding batch providers to state:', newProviders);
          setProviders(prev => [...newProviders, ...prev]);
        }
        return result;
      }
      const provider = Array.isArray(providerOrProviders) ? providerOrProviders[0] : providerOrProviders;
      console.log('Processing single provider:', provider);
      // Manejar campos que pueden ser arrays o strings
      const categories = Array.isArray(provider.categories) ? provider.categories : 
                       (typeof provider.categories === 'string' ? [provider.categories] : []);
      const tags = Array.isArray(provider.tags) ? provider.tags : 
                  (typeof provider.tags === 'string' ? [provider.tags] : []);
      const cuitDigits = String(provider.cuitCuil || '').replace(/[^0-9]/g, '');
      const snakeCaseProvider = {
        name: provider.name,
        email: provider.email,
        contact_name: provider.contactName,
        phone: provider.phone,
        address: provider.address,
        categories: categories,
        tags: tags,
        notes: provider.notes,
        cbu: provider.cbu || '',
        alias: provider.alias || '',
        razon_social: provider.razonSocial || '',
        cuit_cuil: cuitDigits || '',
        default_delivery_days: provider.defaultDeliveryDays || [],
        default_delivery_time: provider.defaultDeliveryTime || [],
        default_payment_method: provider.defaultPaymentMethod || 'efectivo',
        payment_term_days: provider.paymentTermDays || 30, // Plazo de pago en días
        auto_order_flow_enabled: provider.autoOrderFlowEnabled !== undefined ? provider.autoOrderFlowEnabled : true,
        catalogs: provider.catalogs || [],
        created_at: provider.createdAt,
        updated_at: provider.updatedAt,
        user_id: user_id,
      };
      console.log('📝 Datos a insertar en Supabase:', snakeCaseProvider);
      console.log('Inserting snakeCaseProvider:', snakeCaseProvider);
      const result = await supabase.from('providers').insert([snakeCaseProvider]);
      console.log('Supabase result:', result);
      if (result.error) {
        // Manejo de conflicto (409) por CUIT duplicado: buscar existente del usuario
        const statusCode = result.status || result.error.code || '';
        const errorMessage = String(result.error.message || '').toLowerCase();
        const errorDetails = String(result.error.details || '').toLowerCase();
        const maybeConflict = statusCode === 409 || 
                              String(statusCode).includes('409') || 
                              errorMessage.includes('duplicate') || 
                              errorMessage.includes('unique') ||
                              errorDetails.includes('duplicate') ||
                              errorDetails.includes('unique');
        
        if (maybeConflict) {
          console.log('⚠️ [addProvider] Conflicto detectado (CUIT duplicado), buscando proveedor existente...');
          try {
            const digits = String(provider.cuitCuil || '').replace(/[^0-9]/g, '');
            if (!digits || digits.length < 8) {
              console.warn('⚠️ [addProvider] CUIT inválido o vacío, no se puede buscar existente');
              throw result.error;
            }
            
            console.log(`🔍 [addProvider] Buscando proveedor con CUIT: ${digits} para usuario: ${user_id}`);
            
            // NOTA: Diferentes usuarios pueden tener proveedores con el mismo CUIT
            // Por ejemplo, "Coca Cola" puede ser proveedor de múltiples restaurantes
            // Solo buscamos en los proveedores del usuario actual
            
            // 1. Búsqueda en proveedores del usuario actual por CUIT
            let { data: existingList, error: fetchErr } = await supabase
              .from('providers')
              .select('*')
              .eq('user_id', user_id)
              .eq('cuit_cuil', digits)
              .order('created_at', { ascending: false })
              .limit(1);
            
            // Si encontramos uno del usuario actual, usarlo
            if (existingList && existingList.length > 0) {
              console.log(`✅ [addProvider] Proveedor encontrado del usuario actual: ${existingList[0].name}`);
            }
            
            // 2. Si no encontramos, buscar con formato con guiones
            if ((!existingList || existingList.length === 0) && digits.length === 11) {
              const formattedCuit = `${digits.slice(0,2)}-${digits.slice(2,10)}-${digits.slice(10)}`;
              console.log(`🔍 [addProvider] Intentando búsqueda con formato: ${formattedCuit}`);
              const { data: formattedList } = await supabase
                .from('providers')
                .select('*')
                .eq('user_id', user_id)
                .eq('cuit_cuil', formattedCuit)
                .order('created_at', { ascending: false })
                .limit(1);
              
              if (formattedList && formattedList.length > 0) {
                existingList = formattedList;
              }
            }
            
            // 3. Si aún no encontramos, buscar con ilike (búsqueda flexible)
            if (!existingList || existingList.length === 0) {
              console.log(`🔍 [addProvider] Intentando búsqueda flexible con ilike`);
              const { data: flexibleList } = await supabase
                .from('providers')
                .select('*')
                .eq('user_id', user_id)
                .ilike('cuit_cuil', `%${digits}%`)
                .order('created_at', { ascending: false })
                .limit(1);
              
              if (flexibleList && flexibleList.length > 0) {
                existingList = flexibleList;
              }
            }
            
            // 4. Último intento: usar el endpoint de API del servidor (tiene permisos de service role)
            if (!existingList || existingList.length === 0) {
              console.log(`🔍 [addProvider] Intentando búsqueda a través de API del servidor (último intento)`);
              try {
                const apiResponse = await fetch(`/api/data/providers?user_id=${user_id}`);
                if (apiResponse.ok) {
                  const apiData = await apiResponse.json();
                  if (apiData.success && apiData.providers) {
                    // Buscar en la lista de proveedores del usuario
                    const found = apiData.providers.find((p: any) => {
                      const pCuit = String(p.cuit_cuil || p.cuitCuil || '').replace(/[^0-9]/g, '');
                      return pCuit === digits;
                    });
                    
                    if (found) {
                      console.log(`✅ [addProvider] Proveedor encontrado a través de API:`, found.name);
                      // Convertir al formato de Supabase raw
                      const rawProvider = {
                        id: found.id,
                        user_id: found.user_id,
                        name: found.name,
                        email: found.email || '',
                        contact_name: found.contact_name || found.contactName || '',
                        phone: found.phone || '',
                        address: found.address || '',
                        categories: found.categories || [],
                        tags: found.tags || [],
                        notes: found.notes || '',
                        cbu: found.cbu || '',
                        alias: found.alias || '',
                        razon_social: found.razon_social || found.razonSocial || '',
                        cuit_cuil: found.cuit_cuil || found.cuitCuil || '',
                        default_delivery_days: found.default_delivery_days || found.defaultDeliveryDays || [],
                        default_delivery_time: found.default_delivery_time || found.defaultDeliveryTime || [],
                        default_payment_method: found.default_payment_method || found.defaultPaymentMethod || 'efectivo',
                        auto_order_flow_enabled: found.auto_order_flow_enabled !== undefined ? found.auto_order_flow_enabled : found.autoOrderFlowEnabled !== undefined ? found.autoOrderFlowEnabled : true,
                        catalogs: found.catalogs || [],
                        created_at: found.created_at || found.createdAt,
                        updated_at: found.updated_at || found.updatedAt
                      };
                      existingList = [rawProvider];
                    }
                  }
                }
              } catch (apiError) {
                console.warn('⚠️ [addProvider] Error en búsqueda por API:', apiError);
              }
            }
            
            // Si encontramos un proveedor del usuario actual, usarlo
            if (existingList && existingList.length > 0) {
              const existingProvider = mapProviderFromDb(existingList[0]);
              console.log('✅ [addProvider] Proveedor existente encontrado:', existingProvider.name, 'ID:', existingProvider.id);
              setProviders(prev => {
                const filtered = prev.filter(p => p.id !== existingProvider.id);
                return [existingProvider, ...filtered];
              });
              // Retornar el proveedor existente en formato compatible con el flujo
              return { 
                data: [existingList[0]], 
                error: null,
                status: 200,
                statusText: 'OK'
              } as any;
            }
            
            // Si no encontramos un proveedor del usuario actual pero hay conflicto,
            // puede ser que:
            // 1. El constraint único global todavía existe (necesita migración)
            // 2. Hay un problema de RLS que impide leer el proveedor
            // 3. El proveedor existe pero con formato diferente de CUIT
            
            // En cualquier caso, si no encontramos uno del usuario actual,
            // intentamos usar el endpoint de API que tiene permisos de service role
            // para verificar si realmente existe o no
            
            console.warn('⚠️ [addProvider] Conflicto de CUIT pero no se encontró proveedor del usuario actual');
            console.warn('⚠️ [addProvider] Esto puede indicar que el constraint único global todavía existe');
            console.warn('⚠️ [addProvider] Se requiere ejecutar la migración SQL: docs/fix-providers-cuit-constraint.sql');
            
            // Mostrar mensaje informativo
            const customError = {
              ...result.error,
              message: `Error: Conflicto al crear proveedor con CUIT ${digits}. Si el CUIT ya está registrado para tu usuario, debería haberse encontrado. Si necesitas crear un proveedor con este CUIT y no existe en tu cuenta, puede ser necesario ejecutar la migración SQL para cambiar el constraint de único global a único por usuario.`,
              userMessage: 'Error al crear el proveedor. El CUIT puede estar duplicado o puede haber un problema con la base de datos. Si el proveedor no existe en tu cuenta, contacta al administrador para ejecutar la migración SQL necesaria.'
            };
            throw customError;
          } catch (e) {
            console.error('❌ [addProvider] Error en manejo de conflicto:', e);
            // Si el error es diferente al original, lanzar el original
            if (e !== result.error) {
              throw result.error;
            }
            throw e;
          }
        }
        console.error('❌ [addProvider] Error agregando proveedor:', result.error);
        throw result.error;
      }
      // Agregar la nueva fila al principio de la lista en lugar de recargar todo
      if (result.data && Array.isArray(result.data) && (result.data as any[]).length > 0) {
        const newProvider = mapProviderFromDb((result.data as any[])[0]);
        console.log('Adding new provider to state:', newProvider);
        setProviders(prev => {
          console.log('Previous providers:', prev);
          const updated = [newProvider, ...prev];
          console.log('Updated providers:', updated);
          return updated;
        });
      }
      return result;
    } catch (error) {
      console.error('Error in addProvider:', error);
      throw error;
    }
  }, []);
  const updateProvider = useCallback(async (provider: Provider) => {
    try {
      // Manejar campos que pueden ser arrays o strings
      const categories = Array.isArray(provider.categories) ? provider.categories : 
                       (typeof provider.categories === 'string' ? [provider.categories] : []);
      const tags = Array.isArray(provider.tags) ? provider.tags : 
                  (typeof provider.tags === 'string' ? [provider.tags] : []);
      const cuitDigitsUpd = String(provider.cuitCuil || '').replace(/[^0-9]/g, '');
      const snakeCaseProvider = {
        name: provider.name,
        email: provider.email,
        contact_name: provider.contactName,
        phone: provider.phone,
        address: provider.address,
        categories: categories,
        tags: tags,
        notes: provider.notes,
        cbu: provider.cbu || '',
        alias: provider.alias || '',
        razon_social: provider.razonSocial || '',
        cuit_cuil: cuitDigitsUpd || '',
        default_delivery_days: provider.defaultDeliveryDays || [],
        default_delivery_time: provider.defaultDeliveryTime || [],
        default_payment_method: provider.defaultPaymentMethod || 'efectivo',
        payment_term_days: provider.paymentTermDays || 30, // Plazo de pago en días
        auto_order_flow_enabled: provider.autoOrderFlowEnabled !== undefined ? provider.autoOrderFlowEnabled : true,
        catalogs: provider.catalogs || [],
        updated_at: new Date(),
      };
      console.log('📝 Datos a enviar a Supabase:', snakeCaseProvider);
      const { error } = await supabase.from('providers').update(snakeCaseProvider).eq('id', provider.id);
      if (error) {
        console.error('Error updating provider:', error);
        throw error;
      }
      // Actualizar solo el proveedor específico en lugar de recargar todo
      setProviders(prev => prev.map(p => p.id === provider.id ? provider : p));
    } catch (error) {
      console.error('Error in updateProvider:', error);
      throw error;
    }
  }, []);
  // Permitir batch delete
  const deleteProvider = useCallback(async (idOrIds: string | string[], user_id: string, batch = false, forceDelete = false) => {
    try {
      if (batch && Array.isArray(idOrIds)) {
        // Borrar uno por uno para evitar errores 409
        let successCount = 0;
        let errorCount = 0;
        let deletedOrdersCount = 0;
        for (const id of idOrIds) {
          try {
            // Primero verificar si el proveedor existe y pertenece al usuario
            const { data: provider, error: checkError } = await supabase
              .from('providers')
              .select('id, name')
              .eq('id', id)
              .eq('user_id', user_id)
              .single();
            if (checkError || !provider) {
              console.error(`Provider ${id} no encontrado o no pertenece al usuario:`, checkError);
              errorCount++;
              continue;
            }
            // Verificar si tiene pedidos asociados
            const { data: orders, error: ordersError } = await supabase
              .from('orders')
              .select('id')
              .eq('provider_id', id);
            if (ordersError) {
              console.error(`Error checking orders for provider ${id}:`, ordersError);
            } else if (orders && orders.length > 0) {
              if (forceDelete) {
                // Borrar pedidos asociados primero
                console.log(`Borrando ${orders.length} pedidos asociados al proveedor ${id} (${provider.name})`);
                const { error: deleteOrdersError } = await supabase
                  .from('orders')
                  .delete()
                  .eq('provider_id', id)
                  .eq('user_id', user_id);
                if (deleteOrdersError) {
                  console.error(`Error deleting orders for provider ${id}:`, deleteOrdersError);
                  errorCount++;
                  continue;
                } else {
                  deletedOrdersCount += orders.length;
                  console.log(`${orders.length} pedidos eliminados para el proveedor ${id} (${provider.name})`);
                }
              } else {
                console.error(`Provider ${id} (${provider.name}) tiene ${orders.length} pedidos asociados y no puede ser eliminado`);
                errorCount++;
                continue;
              }
            }
            // Intentar borrar el proveedor
            const { error } = await supabase.from('providers').delete().eq('id', id).eq('user_id', user_id);
            if (error) {
              console.error(`Error deleting provider ${id} (${provider.name}):`, error);
              errorCount++;
            } else {
              console.log(`Provider ${id} (${provider.name}) eliminado exitosamente`);
              successCount++;
            }
          } catch (err) {
            console.error(`Error deleting provider ${id}:`, err);
            errorCount++;
          }
        }
        console.log(`Borrado completado: ${successCount} proveedores exitosos, ${errorCount} errores, ${deletedOrdersCount} pedidos eliminados`);
        if (errorCount > 0) {
          console.warn(`⚠️ ${errorCount} proveedores no pudieron ser eliminados. Revisa los logs anteriores para más detalles.`);
        }
        await fetchAll();
        return;
      }
      const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
      const { error } = await supabase.from('providers').delete().eq('id', id).eq('user_id', user_id);
      if (error) {
        console.error('Error deleting provider:', error);
        throw error;
      }
      await fetchAll();
    } catch (error) {
      console.error('Error in deleteProvider:', error);
      throw error;
    }
  }, [fetchAll]);
  // CRUD: Stock
  // Permitir batch insert
  const addStockItem = useCallback(async (itemOrItems: Partial<StockItem>|Partial<StockItem>[], user_id: string, batch = false) => {
    try {
      if (batch && Array.isArray(itemOrItems)) {
        // Validar y convertir quantity para todos los items
        const validatedItems = itemOrItems.map(item => ({
          ...item,
          quantity: item.quantity === null || item.quantity === undefined ? 0 : Number(item.quantity),
          associatedProviders: Array.isArray(item.associatedProviders) ? item.associatedProviders : [],
          lastOrdered: item.lastOrdered && !isNaN(Date.parse(String(item.lastOrdered))) ? new Date(item.lastOrdered) : null,
          nextOrder: item.nextOrder && !isNaN(Date.parse(String(item.nextOrder))) ? new Date(item.nextOrder) : null,
        }));
        // Convertir a snake_case para Supabase
        const snakeCaseItems = validatedItems.map(item => ({
          product_name: item.productName || '',
          category: item.category || 'Other',
          quantity: item.quantity,
          unit: item.unit || '',
          restock_frequency: item.restockFrequency || 'weekly',
          associated_providers: item.associatedProviders,
          preferred_provider: item.preferredProvider || '',
          last_ordered: item.lastOrdered,
          next_order: item.nextOrder,
          created_at: item.createdAt || new Date(),
          updated_at: item.updatedAt || new Date(),
          user_id: user_id,
        }));
        // Insertar todos los items en un solo llamado
        const result = await supabase.from('stock').insert(snakeCaseItems);
        if (result.error) {
          console.error('Supabase error al insertar stock (batch):', result.error, itemOrItems);
          throw result.error;
        }
        // Agregar las nuevas filas al principio en lugar de recargar todo
        if (result.data && Array.isArray(result.data) && (result.data as any[]).length > 0) {
          const newStockItems = (result.data as any[]).map(mapStockItemFromDb);
          setStockItems(prev => [...newStockItems, ...prev]);
        }
        return;
      }
      // Comportamiento original: uno por uno
      const item = Array.isArray(itemOrItems) ? itemOrItems[0] : itemOrItems;
      // Validaciones mejoradas
      const quantity = item.quantity === null || item.quantity === undefined ? 0 : Number(item.quantity);
      const associatedProviders = Array.isArray(item.associatedProviders) ? item.associatedProviders : [];
      const lastOrdered = item.lastOrdered && !isNaN(Date.parse(String(item.lastOrdered))) ? new Date(item.lastOrdered) : null;
      const nextOrder = item.nextOrder && !isNaN(Date.parse(String(item.nextOrder))) ? new Date(item.nextOrder) : null;
      const snakeCaseItem = {
        product_name: item.productName || '',
        category: item.category || 'Other',
        quantity: quantity,
        unit: item.unit || '',
        restock_frequency: item.restockFrequency || 'weekly',
        associated_providers: associatedProviders,
        preferred_provider: item.preferredProvider || '',
        last_ordered: lastOrdered,
        next_order: nextOrder,
        created_at: item.createdAt || new Date(),
        updated_at: item.updatedAt || new Date(),
        user_id: user_id,
      };
      const result = await supabase.from('stock').insert([snakeCaseItem]);
      if (result.error) {
        console.error('Supabase error al insertar stock:', result.error, snakeCaseItem);
        throw result.error;
      }
      // Agregar la nueva fila al principio de la lista en lugar de recargar todo
      if (result.data && Array.isArray(result.data) && (result.data as any[]).length > 0) {
        const newStockItem = mapStockItemFromDb((result.data as any[])[0]);
        setStockItems(prev => [newStockItem, ...prev]);
      }
    } catch (error) {
      console.error('Error in addStockItem:', error);
      throw error;
    }
  }, []);
  const updateStockItem = useCallback(async (item: StockItem) => {
    try {
      // Validaciones mejoradas
      const quantity = item.quantity === null || item.quantity === undefined ? 0 : Number(item.quantity);
      const associatedProviders = Array.isArray(item.associatedProviders) ? item.associatedProviders : [];
      const lastOrdered = item.lastOrdered && !isNaN(Date.parse(String(item.lastOrdered))) ? new Date(item.lastOrdered) : null;
      const nextOrder = item.nextOrder && !isNaN(Date.parse(String(item.nextOrder))) ? new Date(item.nextOrder) : null;
      const snakeCaseItem = {
        product_name: item.productName || '',
        category: item.category || 'Other',
        quantity: quantity,
        unit: item.unit || '',
        restock_frequency: item.restockFrequency || 'weekly',
        associated_providers: associatedProviders,
        preferred_provider: item.preferredProvider || '',
        last_ordered: lastOrdered,
        next_order: nextOrder,
        updated_at: new Date(),
      };
      const { error } = await supabase.from('stock').update(snakeCaseItem).eq('id', item.id);
      if (error) {
        console.error('Error updating stock item:', error);
        throw error;
      }
      // Actualizar solo el item específico en lugar de recargar todo
      setStockItems(prev => prev.map(s => s.id === item.id ? item : s));
    } catch (error) {
      console.error('Error in updateStockItem:', error);
      throw error;
    }
  }, []);
  // Permitir batch delete
  const deleteStockItem = useCallback(async (idOrIds: string | string[], user_id: string, batch = false) => {
    try {
      if (batch && Array.isArray(idOrIds)) {
        const { error } = await supabase.from('stock').delete().in('id', idOrIds).eq('user_id', user_id);
        if (error) {
          console.error('Error deleting stock items (batch):', error);
          throw error;
        }
        // Remover items del estado en lugar de recargar todo
        setStockItems(prev => prev.filter(item => !idOrIds.includes(item.id)));
        return;
      }
      const id = Array.isArray(idOrIds) ? idOrIds[0] : idOrIds;
      const { error } = await supabase.from('stock').delete().eq('id', id).eq('user_id', user_id);
      if (error) {
        console.error('Error deleting stock item:', error);
        throw error;
      }
      // Remover item del estado en lugar de recargar todo
      setStockItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error in deleteStockItem:', error);
      throw error;
    }
  }, [fetchAll]);
  return (
    <DataContext.Provider value={{
      orders,
      providers,
      stockItems,
      loading,
      fetchAll,
      addOrder,
      updateOrder,
      deleteOrder,
      addProvider,
      updateProvider,
      deleteProvider,
      addStockItem,
      updateStockItem,
      deleteStockItem,
      setStockItems,
      setOrders,
    }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando datos...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </DataContext.Provider>
  );
};
// ---
// Recommended RLS policy for users table (add in Supabase SQL editor):
//
// alter table users enable row level security;
// create policy "Allow select and insert for all" on users for select using (true);
// create policy "Allow insert for all" on users for insert with check (true);
//
// For production, restrict as needed (e.g. auth.uid() = id)
// --- bisi