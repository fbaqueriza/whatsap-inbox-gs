import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Order, Provider, StockItem, WhatsAppMessage } from '../types';
import { supabase } from '../lib/supabase/client';
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

// Función para mapear Order de snake_case a camelCase
function mapOrderFromDb(order: any): Order {
  return {
    ...order,
    providerId: order.provider_id,
    totalAmount: order.total_amount,
    orderDate: order.order_date,
    dueDate: order.due_date,
    invoiceNumber: order.invoice_number,
    bankInfo: order.bank_info,
    receiptUrl: order.receipt_url,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    id: order.id,
    user_id: order.user_id,
  };
}

// Función para mapear Provider de snake_case a camelCase
function mapProviderFromDb(provider: any): Provider {
  return {
    ...provider,
    contactName: provider.contactName,
    razonSocial: provider.razon_social,
    cuitCuil: provider.cuit_cuil,
    defaultDeliveryDays: provider.default_delivery_days || [],
    defaultDeliveryTime: provider.default_delivery_time || [],
    defaultPaymentMethod: provider.default_payment_method || 'efectivo',
    catalogs: provider.catalogs || [],
    createdAt: provider.created_at,
    updatedAt: provider.updated_at,
    id: provider.id,
    user_id: provider.user_id,
  };
}

export const DataProvider: React.FC<{ userEmail?: string; userId?: string; children: React.ReactNode }> = ({ userEmail, userId, children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(userId || null);

  // Fetch user_id from email if not provided
  useEffect(() => {
    if (!userEmail && !userId) return;
    if (userId) {
      setCurrentUserId(userId);
      return;
    }
    const fetchUserId = async () => {
      if (!userEmail) return;
      try {
        const { data: userData, error: userError, status } = await supabase
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .single();
        if (!userError && userData) {
          setCurrentUserId(userData.id as string);
        } else if (status === 406 || (userError && userError.code === 'PGRST116')) {
          // 406 Not Acceptable or not found: create user row
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([{ email: userEmail }])
            .select('id')
            .single();
          if (!createError && newUser) {
            setCurrentUserId(newUser.id as string);
          } else {
            setCurrentUserId(null);
            setLoading(false);
            setErrorMsg('No se pudo crear el usuario en la base de datos.');
          }
        } else {
          setCurrentUserId(null);
          setLoading(false);
          setErrorMsg('Error al buscar el usuario en la base de datos.');
        }
      } catch (err) {
        setCurrentUserId(null);
        setLoading(false);
        setErrorMsg('Error inesperado al buscar/crear usuario.');
      }
    };
    fetchUserId();
  }, [userEmail, userId]);

  // Error state for user fetch/creation
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Fetch all data for the user
  const fetchAll = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const [{ data: provs, error: provError }, { data: ords, error: ordError }, { data: stocks, error: stockError }] = await Promise.all([
        supabase.from('providers').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
        supabase.from('stock').select('*').eq('user_id', currentUserId).order('preferred_provider', { ascending: true }).order('created_at', { ascending: false }),
      ]);
      
      if (provError) console.error('Error fetching providers:', provError);
      if (ordError) console.error('Error fetching orders:', ordError);
      if (stockError) console.error('Error fetching stock:', stockError);
      
      const mappedProviders = (provs || []).map(mapProviderFromDb);
      
      setProviders(mappedProviders);
      setOrders((ords || []).map(mapOrderFromDb));
      setStockItems((stocks || []).map(mapStockItemFromDb));
    } catch (error) {
      console.error('Error in fetchAll:', error);
      setErrorMsg('Error al cargar los datos. Por favor, recarga la página.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchAll();
    }
  }, [currentUserId]); // Solo depende de currentUserId, no de fetchAll

  // CRUD: Orders
  const addOrder = useCallback(async (order: Partial<Order>, user_id: string) => {
    try {
      // Mapear campos a snake_case
      const snakeCaseOrder = {
        provider_id: (order as any).providerId,
        user_id,
        items: order.items,
        status: order.status,
        total_amount: (order as any).totalAmount,
        currency: order.currency,
        order_date: (order as any).orderDate,
        due_date: (order as any).dueDate,
        invoice_number: (order as any).invoiceNumber,
        bank_info: (order as any).bankInfo,
        receipt_url: (order as any).receiptUrl,
        notes: order.notes,
        created_at: (order as any).createdAt,
        updated_at: (order as any).updatedAt,
      };
      
      // console.log('📝 Insertando orden en Supabase:', snakeCaseOrder);
      
      const { data, error } = await supabase.from('orders').insert([snakeCaseOrder]).select();
      
      if (error) {
        console.error('Error adding order:', error);
        setErrorMsg('Error al agregar pedido: ' + (error.message || error.details || ''));
        throw error;
      }
      
      // console.log('✅ Orden insertada exitosamente:', data);
      
      // Retornar la orden creada
      if (data && data.length > 0) {
        const createdOrder = mapOrderFromDb(data[0]);
        // console.log('📋 Orden mapeada:', createdOrder);
        return createdOrder;
      }
      
      return null;
    } catch (error) {
      console.error('Error in addOrder:', error);
      throw error;
    }
  }, []);

  const updateOrder = useCallback(async (order: Order) => {
    try {
      // Mapear campos a snake_case para Supabase
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
        notes: order.notes,
        created_at: (order as any).createdAt,
        updated_at: (order as any).updatedAt,
      };
      const { error } = await supabase.from('orders').update(snakeCaseOrder).eq('id', order.id);
      if (error) {
        console.error('Error updating order:', error);
        setErrorMsg('Error al actualizar pedido: ' + (error.message || error.details || ''));
        throw error;
      }
      await fetchAll();
    } catch (error) {
      console.error('Error in updateOrder:', error);
      throw error;
    }
  }, [fetchAll]);

  const deleteOrder = useCallback(async (id: string, user_id: string) => {
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id).eq('user_id', user_id);
      if (error) {
        console.error('Error deleting order:', error);
        setErrorMsg('Error al eliminar pedido: ' + (error.message || error.details || ''));
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
          setErrorMsg('Error al agregar proveedores: ' + (result.error.message || result.error.details || ''));
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
        cuit_cuil: provider.cuitCuil || '',
        default_delivery_days: provider.defaultDeliveryDays || [],
        default_delivery_time: provider.defaultDeliveryTime || [],
        default_payment_method: provider.defaultPaymentMethod || 'efectivo',
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
        console.error('Error adding provider:', result.error);
        setErrorMsg('Error al agregar proveedor: ' + (result.error.message || result.error.details || ''));
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
        cuit_cuil: provider.cuitCuil || '',
        default_delivery_days: provider.defaultDeliveryDays || [],
        default_delivery_time: provider.defaultDeliveryTime || [],
        default_payment_method: provider.defaultPaymentMethod || 'efectivo',
        catalogs: provider.catalogs || [],
        updated_at: new Date(),
      };
      
      console.log('📝 Datos a enviar a Supabase:', snakeCaseProvider);
      const { error } = await supabase.from('providers').update(snakeCaseProvider).eq('id', provider.id);
      if (error) {
        console.error('Error updating provider:', error);
        setErrorMsg('Error al actualizar proveedor: ' + (error.message || error.details || ''));
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
          setErrorMsg('Error al insertar stock: ' + (result.error.message || result.error.details || ''));
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
        setErrorMsg('Error al insertar stock: ' + (result.error.message || result.error.details || ''));
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
        setErrorMsg('Error al actualizar producto: ' + (error.message || error.details || ''));
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
          setErrorMsg('Error al eliminar productos: ' + (error.message || error.details || ''));
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
        setErrorMsg('Error al eliminar producto: ' + (error.message || error.details || ''));
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
            {errorMsg && <div className="mt-4 text-red-500">{errorMsg}</div>}
          </div>
        </div>
      ) : errorMsg ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{errorMsg}</p>
            <button 
              onClick={() => {
                setErrorMsg(null);
                fetchAll();
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
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
// --- 