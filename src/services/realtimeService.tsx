'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useRealtimeManager } from '../hooks/useRealtimeManager';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { mapOrderFromDb } from '../lib/orderMapper';

// Helper para detectar páginas protegidas
const isProtectedPage = (pathname: string): boolean => {
  const protectedPaths = ['/dashboard', '/orders', '/providers', '/stock', '/profile'];
  return protectedPaths.some(path => pathname.startsWith(path));
};
import { supabase } from '../lib/supabase/client';

// Tipos
interface RealtimeMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: string;
  contact_id: string;
  status: string;
  user_id?: string;
  // 🔧 CORRECCIÓN: Agregar campos para documentos
  media_url?: string;
  media_type?: string;
}

interface RealtimeOrder {
  id: string;
  status: string;
  total_amount?: number;
  invoice_number?: string;
  receipt_url?: string;
  invoice_data?: any;
  updated_at?: string;
}

interface RealtimeServiceContextType {
  messages: RealtimeMessage[];
  orders: RealtimeOrder[];
  addMessageListener: (callback: (message: RealtimeMessage) => void) => () => void;
  addOrderListener: (callback: (order: RealtimeOrder) => void) => () => void;
  isConnected: boolean;
  currentUserId: string | null;
}

// Contexto
const RealtimeServiceContext = createContext<RealtimeServiceContextType | undefined>(undefined);

export const useRealtimeService = () => {
  const context = useContext(RealtimeServiceContext);
  if (!context) {
    throw new Error('useRealtimeService must be used within a RealtimeServiceProvider');
  }
  return context;
};

// Provider
export function RealtimeServiceProvider({ children }: { children: React.ReactNode }) {

  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [orders, setOrders] = useState<RealtimeOrder[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 🔧 CORREGIDO: Obtener currentUserId del usuario autenticado
  const { user } = useSupabaseAuth();
  const currentUserId = user?.id || null;

  const messageListeners = useRef<Set<(message: RealtimeMessage) => void>>(new Set());
  const orderListeners = useRef<Set<(order: RealtimeOrder) => void>>(new Set());

  const { subscribe, unsubscribe } = useRealtimeManager();


  // 🔧 CORREGIDO: Ya no necesitamos este useEffect porque currentUserId viene de useSupabaseAuth

  // Handlers para mensajes
  const handleNewMessage = async (payload: any) => {
    const newMessage = payload.new;
    // console.log('🔍 [RealtimeService] Nuevo mensaje recibido:', newMessage?.id);

    if (!newMessage || !currentUserId) {
      console.log('🔐 RealtimeService: Ignorando mensaje - usuario no autenticado');
      return;
    }

    // 🔧 LÓGICA SIMPLIFICADA: Aceptar mensajes del usuario actual O mensajes sin user_id
    const isValidMessage = newMessage.user_id === currentUserId || !newMessage.user_id;

    // console.log('🔍 [RealtimeService] Validación de mensaje:', isValidMessage);

    if (!isValidMessage) {
      console.log('❌ [RealtimeService] Mensaje rechazado - user_id no coincide');
      return; // Ignorar mensaje no válido
    }

    // 🔧 MEJORA: Crear mensaje y notificar listeners
    const message: RealtimeMessage = {
      id: newMessage.id,
      content: newMessage.content,
      timestamp: new Date(newMessage.timestamp),
      type: newMessage.message_type,
      contact_id: newMessage.contact_id,
      status: newMessage.status || 'delivered',
      user_id: newMessage.user_id,
      // 🔧 CORRECCIÓN: Incluir media_url y media_type para documentos
      media_url: newMessage.media_url,
      media_type: newMessage.media_type
    };

    setMessages(prev => {
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) {
        console.log('🔄 [RealtimeService] Mensaje ya existe, ignorando:', message.id);
        return prev;
      }
      // console.log('✅ [RealtimeService] Agregando nuevo mensaje al estado:', message.id);
      return [...prev, message];
    });

    // 🔧 OPTIMIZACIÓN: Notificar a todos los listeners de forma segura
    // console.log('📢 [RealtimeService] Notificando a', messageListeners.current.size, 'listeners');
    messageListeners.current.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error en message listener:', error);
      }
    });

    // 🔧 FALLBACK: Actualizar órdenes cuando se recibe un mensaje nuevo
    try {
      const response = await fetch(`/api/data/orders?user_id=${currentUserId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.orders) {
          const updatedOrders = result.orders.map(mapOrderFromDb);
          setOrders(updatedOrders);
          
          // Notificar a los listeners sobre las órdenes actualizadas
          updatedOrders.forEach(order => {
            orderListeners.current.forEach(callback => {
              try {
                callback(order);
              } catch (error) {
                console.error('Error en order listener:', error);
              }
            });
          });
        }
      }
    } catch (error) {
      console.error('Error actualizando órdenes en fallback:', error);
    }

  };

  const handleMessageUpdate = (payload: any) => {
    const updatedMessage = payload.new;
    if (updatedMessage) {
      // 🔧 CORRECCIÓN: Filtrar actualizaciones por user_id (solo si hay usuario autenticado)
      if (currentUserId && updatedMessage.user_id && updatedMessage.user_id !== currentUserId) {
        return;
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === updatedMessage.id
            ? { ...msg, ...updatedMessage }
            : msg
        )
      );
    }
  };

  const handleMessageDelete = (payload: any) => {
    const deletedMessage = payload.old;
    if (deletedMessage) {
      // 🔧 CORRECCIÓN: Filtrar eliminaciones por user_id (solo si hay usuario autenticado)
      if (currentUserId && deletedMessage.user_id && deletedMessage.user_id !== currentUserId) {
        return;
      }

      setMessages(prev =>
        prev.filter(msg => msg.id !== deletedMessage.id)
      );
    }
  };

  const handleNewOrder = (payload: any) => {
    const newOrder = payload.new;
    if (!newOrder || !currentUserId) {
      console.log('🔐 RealtimeService: Ignorando nueva orden - usuario no autenticado');
      return;
    }

    // 🔧 OPTIMIZACIÓN: Filtrar nuevas órdenes por user_id
    if (newOrder.user_id && newOrder.user_id !== currentUserId) {
      console.log('🔍 RealtimeService: Orden filtrada - user_id no coincide');
      return;
    }

      setOrders(prev => {
        const exists = prev.some(order => order.id === newOrder.id);
        if (exists) return prev;
        return [...prev, newOrder];
      });

      // 🔧 OPTIMIZACIÓN: Notificar a los listeners sobre la nueva orden
      orderListeners.current.forEach(callback => {
        try {
          callback(newOrder);
        } catch (error) {
          console.error('Error en order listener:', error);
        }
      });
  };

  const handleOrderUpdate = (payload: any) => {
    const updatedOrder = payload.new;
    if (!updatedOrder || !currentUserId) {
      return;
    }

    // Filtrar actualizaciones por user_id
    if (updatedOrder.user_id && updatedOrder.user_id !== currentUserId) {
      return;
    }

    // Mapear la orden una sola vez
    const mappedOrder = mapOrderFromDb(updatedOrder);
    
    setOrders(prev =>
      prev.map(order =>
        order.id === updatedOrder.id
          ? { ...order, ...mappedOrder }
          : order
      )
    );

    // Notificar a los listeners sobre la actualización
    orderListeners.current.forEach(callback => {
      try {
        callback(mappedOrder);
      } catch (error) {
        console.error('❌ [RealtimeService] Error en order listener:', error);
      }
    });
  };

  const handleOrderDelete = (payload: any) => {
    const deletedOrder = payload.old;
    if (!deletedOrder || !currentUserId) {
      console.log('🔐 RealtimeService: Ignorando eliminación de orden - usuario no autenticado');
      return;
    }

    // 🔧 OPTIMIZACIÓN: Filtrar eliminaciones por user_id
    if (deletedOrder.user_id && deletedOrder.user_id !== currentUserId) {
      console.log('🔍 RealtimeService: Eliminación de orden filtrada - user_id no coincide');
      return;
    }

    setOrders(prev =>
      prev.filter(order => order.id !== deletedOrder.id)
    );
  };

  // 🔧 FUNCIÓN: Cargar órdenes iniciales
  const loadInitialOrders = useCallback(async () => {
    if (!currentUserId) return;

    try {
      // 🔧 NUEVO: Usar endpoint de API del servidor para evitar problemas de RLS
      const response = await fetch(`/api/data/orders?user_id=${currentUserId}`);
      
      if (!response.ok) {
        console.error('❌ [RealtimeService] Error cargando órdenes iniciales:', response.status);
        return;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('❌ [RealtimeService] Error cargando órdenes iniciales:', result.error);
        return;
      }


      // 🔧 MAPEAR: Mapear órdenes antes de establecerlas
      const mappedOrders = (result.orders || []).map(mapOrderFromDb);
      
      // Órdenes iniciales cargadas
      setOrders(mappedOrders);
      
        // 🔧 NUEVO: Pasar órdenes iniciales al DataProvider
        if (mappedOrders && mappedOrders.length > 0) {
          // Notificar a los listeners de órdenes con las órdenes iniciales mapeadas
          mappedOrders.forEach(order => {
            orderListeners.current.forEach(callback => {
              callback(order);
            });
          });
        }
    } catch (error) {
      console.error('❌ [RealtimeService] Error inesperado cargando órdenes:', error);
    }
  }, [currentUserId, supabase]);

  // 🔧 OPTIMIZACIÓN: Configurar suscripciones una sola vez por usuario
  const subscriptionsInitializedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!currentUserId) {
      // console.log('🔐 RealtimeService: Esperando autenticación...');
      setIsConnected(false);
      return;
    }

    // ✅ SOLUCIÓN: Evitar crear múltiples suscripciones para el mismo usuario
    if (subscriptionsInitializedRef.current.has(currentUserId)) {
      return;
    }

    subscriptionsInitializedRef.current.add(currentUserId);
    
    // console.log('✅ RealtimeService: Usuario autenticado, configurando tiempo real...');
    setIsConnected(true);

    // 🔧 CARGAR ÓRDENES INICIALES
    loadInitialOrders();

    // 🔧 SOLUCIÓN OPTIMIZADA: Una sola llamada de suscripción por tipo
    const setupWhatsAppSuscription = async () => {
      try {
        // 🔧 FIX: Agregar filtro por user_id para que RLS permita los mensajes
        await subscribe(
          {
            table: 'whatsapp_messages',
            event: '*',
            filter: currentUserId ? `user_id=eq.${currentUserId}` : undefined
          },
          {
            onInsert: handleNewMessage,
            onUpdate: handleMessageUpdate,
            onDelete: handleMessageDelete
          },
          {
            debounceMs: 150,
            retryConfig: {
              maxRetries: 5,
              retryDelay: 2000,
              backoffMultiplier: 1.5
            }
          }
        );
        console.log(`✅ RealtimeService: Suscripción a whatsapp_messages activa para user_id: ${currentUserId}`);
        setIsConnected(true);
      } catch (error) {
        console.error(`❌ RealtimeService: Error configurando suscripción a whatsapp_messages:`, error);
        setIsConnected(false);
      }
    };

    setupWhatsAppSuscription();

    // 🔧 SOLUCIÓN OPTIMIZADA: Suscripción a órdenes con configuración única
    const setupOrdersSuscription = async () => {
      try {
        await subscribe(
          {
            table: 'orders',
            event: '*',
            filter: currentUserId ? `user_id=eq.${currentUserId}` : undefined
          },
          {
            onInsert: handleNewOrder,
            onUpdate: handleOrderUpdate,
            onDelete: handleOrderDelete
          },
          {
            debounceMs: 100,
            retryConfig: {
              maxRetries: 3,
              retryDelay: 1000,
              backoffMultiplier: 2
            }
          }
        );
      } catch (error) {
        console.error(`❌ [RealtimeService] Error configurando suscripción a orders:`, error);
      }
    };

    setupOrdersSuscription();




    return () => {
      // ✅ SOLUCIÓN: Limpiar suscripciones cuando el usuario cambie
      if (currentUserId && subscriptionsInitializedRef.current.has(currentUserId)) {
        console.log(`🔌 RealtimeService: Desuscribiendo de mensajes y órdenes para usuario ${currentUserId}`);
        
        // Remover del conjunto de usuarios inicializados
        subscriptionsInitializedRef.current.delete(currentUserId);
        
        // Una sola llamada de desuscripción por tabla
        unsubscribe({
          table: 'whatsapp_messages',
          event: '*'
        });
        
        unsubscribe({
          table: 'orders', 
          event: '*',
          filter: currentUserId ? `user_id=eq.${currentUserId}` : undefined
        });
      }
    };
  }, [currentUserId, subscribe, unsubscribe]);

  // Funciones para agregar/remover listeners
  // 🔧 SOLUCIÓN UNIFICADA: addMessageListener con referencia estable
  const addMessageListener = useCallback((callback: (message: RealtimeMessage) => void) => {
    messageListeners.current.add(callback);
    return () => {
      messageListeners.current.delete(callback);
    };
  }, []); // ✅ DEPENDENCIAS VACÍAS para mantener referencia estable

  // 🔧 SOLUCIÓN UNIFICADA: addOrderListener con referencia estable
  const addOrderListener = useCallback((callback: (order: RealtimeOrder) => void) => {
    orderListeners.current.add(callback);
    return () => {
      orderListeners.current.delete(callback);
    };
  }, []); // ✅ DEPENDENCIAS VACÍAS para mantener referencia estable

  const value = {
    messages,
    orders,
    addMessageListener,
    addOrderListener,
    isConnected,
    currentUserId
  };


  return (
    <RealtimeServiceContext.Provider value={value}>
      {children}
    </RealtimeServiceContext.Provider>
  );
}