'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRealtimeManager } from '../hooks/useRealtimeManager';
import { supabase } from '../lib/supabase/client';

// Tipos
interface RealtimeMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'sent' | 'received';
  contact_id: string;
  status: string;
  user_id?: string;
}

interface RealtimeOrder {
  id: string;
  status: string;
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

// Hook personalizado
export const useRealtimeService = () => {
  const context = useContext(RealtimeServiceContext);
  if (context === undefined) {
    throw new Error('useRealtimeService must be used within a RealtimeServiceProvider');
  }
  return context;
};

// Provider
export function RealtimeServiceProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [orders, setOrders] = useState<RealtimeOrder[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const messageListeners = useRef<Set<(message: RealtimeMessage) => void>>(new Set());
  const orderListeners = useRef<Set<(order: RealtimeOrder) => void>>(new Set());
  
  const { subscribe, unsubscribe } = useRealtimeManager();

  // 🔧 OPTIMIZACIÓN: Obtener usuario actual una sola vez
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);
      } catch (error) {
        console.error('Error obteniendo usuario actual:', error);
        setCurrentUserId(null);
      }
    };

    getCurrentUser();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handlers para mensajes
  const handleNewMessage = async (payload: any) => {
    const newMessage = payload.new;
    if (newMessage) {
      // 🔧 CORRECCIÓN: Para mensajes de factura, siempre procesar si tienen user_id válido
      if (newMessage.user_id && currentUserId && newMessage.user_id !== currentUserId) {
        return; // Ignorar mensajes de otros usuarios
      }

      // 🔧 CORRECCIÓN: Para mensajes sin user_id (del proveedor), verificar que el contact_id corresponda a un proveedor del usuario
      if (!newMessage.user_id && currentUserId) {
        try {
          const { data: provider } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('phone', newMessage.contact_id)
            .single();
          
          if (!provider) {
            return; // No es un proveedor del usuario actual
          }
        } catch (error) {
          return; // Error o no es un proveedor del usuario actual
        }
      }

      const message: RealtimeMessage = {
        id: newMessage.id,
        content: newMessage.content,
        timestamp: new Date(newMessage.timestamp),
        type: newMessage.message_type,
        contact_id: newMessage.contact_id,
        status: newMessage.status || 'delivered',
        user_id: newMessage.user_id
      };
      
      setMessages(prev => {
        const exists = prev.some(msg => msg.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
      
      messageListeners.current.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error en message listener:', error);
        }
      });
    }
  };

  const handleMessageUpdate = (payload: any) => {
    const updatedMessage = payload.new;
    if (updatedMessage) {
      // 🔧 OPTIMIZACIÓN: Filtrar actualizaciones por user_id
      if (updatedMessage.user_id && currentUserId && updatedMessage.user_id !== currentUserId) {
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
      // 🔧 OPTIMIZACIÓN: Filtrar eliminaciones por user_id
      if (deletedMessage.user_id && currentUserId && deletedMessage.user_id !== currentUserId) {
        return;
      }

      setMessages(prev => 
        prev.filter(msg => msg.id !== deletedMessage.id)
      );
    }
  };

  const handleNewOrder = (payload: any) => {
    const newOrder = payload.new;
    if (newOrder) {
      // 🔧 OPTIMIZACIÓN: Filtrar nuevas órdenes por user_id
      if (newOrder.user_id && currentUserId && newOrder.user_id !== currentUserId) {
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
    }
  };

  const handleOrderUpdate = (payload: any) => {
    const updatedOrder = payload.new;
    if (updatedOrder) {
      // 🔧 OPTIMIZACIÓN: Filtrar actualizaciones por user_id
      if (updatedOrder.user_id && currentUserId && updatedOrder.user_id !== currentUserId) {
        return;
      }

      setOrders(prev => 
        prev.map(order => 
          order.id === updatedOrder.id 
            ? { ...order, ...updatedOrder }
            : order
        )
      );
      
      // 🔧 OPTIMIZACIÓN: Notificar a los listeners sobre la actualización
      orderListeners.current.forEach(callback => {
        try {
          callback(updatedOrder);
        } catch (error) {
          console.error('Error en order listener:', error);
        }
      });
    }
  };

  const handleOrderDelete = (payload: any) => {
    const deletedOrder = payload.old;
    if (deletedOrder) {
      // 🔧 OPTIMIZACIÓN: Filtrar eliminaciones por user_id
      if (deletedOrder.user_id && currentUserId && deletedOrder.user_id !== currentUserId) {
        return;
      }

      setOrders(prev => 
        prev.filter(order => order.id !== deletedOrder.id)
      );
    }
  };

  // 🔧 OPTIMIZACIÓN: Configurar suscripciones solo cuando hay usuario autenticado
  useEffect(() => {
    if (!currentUserId) {
      console.log('🔄 RealtimeService: Usuario no autenticado, no configurando suscripciones');
      return;
    }

    console.log(`🔗 RealtimeService: Configurando suscripciones para usuario ${currentUserId}`);

    // Suscripción a mensajes con filtro por user_id Y contact_id de proveedores
    subscribe(
      { 
        table: 'whatsapp_messages', 
        event: '*',
        filter: `user_id=eq.${currentUserId}` // 🔧 FILTRO CRÍTICO: Solo mensajes del usuario actual
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

    // 🔧 NUEVA SUSCRIPCIÓN: Mensajes de proveedores (donde contact_id corresponde a proveedores del usuario)
    subscribe(
      { 
        table: 'whatsapp_messages', 
        event: '*',
        filter: `user_id=is.null` // 🔧 FILTRO CRÍTICO: Mensajes sin user_id (del proveedor)
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

    // Suscripción a órdenes con filtro por user_id
    subscribe(
      { 
        table: 'orders', 
        event: '*',
        filter: `user_id=eq.${currentUserId}` // 🔧 FILTRO CRÍTICO: Solo órdenes del usuario actual
      },
      {
        onInsert: handleNewOrder,
        onUpdate: handleOrderUpdate,
        onDelete: handleOrderDelete
      },
      {
        debounceMs: 300,
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2
        }
      }
    );

    setIsConnected(true);

    return () => {
      console.log(`🔌 RealtimeService: Desuscribiendo de mensajes y órdenes para usuario ${currentUserId}`);
      unsubscribe({ 
        table: 'whatsapp_messages', 
        event: '*',
        filter: `user_id=eq.${currentUserId}`
      });
      unsubscribe({ 
        table: 'whatsapp_messages', 
        event: '*',
        filter: `user_id=is.null`
      });
      unsubscribe({ 
        table: 'orders', 
        event: '*',
        filter: `user_id=eq.${currentUserId}`
      });
    };
  }, [currentUserId, subscribe, unsubscribe]); // 🔧 DEPENDENCIA CRÍTICA: currentUserId

  // Funciones para agregar/remover listeners
  const addMessageListener = (callback: (message: RealtimeMessage) => void) => {
    messageListeners.current.add(callback);
    return () => {
      messageListeners.current.delete(callback);
    };
  };

  const addOrderListener = (callback: (order: RealtimeOrder) => void) => {
    orderListeners.current.add(callback);
    return () => {
      orderListeners.current.delete(callback);
    };
  };

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
