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
  const handleNewMessage = (payload: any) => {
    const newMessage = payload.new;
    if (newMessage) {
      // 🔧 OPTIMIZACIÓN: Filtrar mensajes por user_id del usuario actual
      if (newMessage.user_id && currentUserId && newMessage.user_id !== currentUserId) {
        return; // Ignorar mensajes de otros usuarios
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
      setOrders(prev => {
        const exists = prev.some(order => order.id === newOrder.id);
        if (exists) return prev;
        return [...prev, newOrder];
      });
    }
  };

  const handleOrderUpdate = (payload: any) => {
    const updatedOrder = payload.new;
    if (updatedOrder) {
      setOrders(prev => 
        prev.map(order => 
          order.id === updatedOrder.id 
            ? { ...order, ...updatedOrder }
            : msg
        )
      );
    }
  };

  const handleOrderDelete = (payload: any) => {
    const deletedOrder = payload.old;
    if (deletedOrder) {
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

    // Suscripción a mensajes con filtro por user_id
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

    // Suscripción a órdenes (sin filtro por ahora)
    subscribe(
      { table: 'orders', event: '*' },
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
      console.log(`🔌 RealtimeService: Desuscribiendo de mensajes para usuario ${currentUserId}`);
      unsubscribe({ 
        table: 'whatsapp_messages', 
        event: '*',
        filter: `user_id=eq.${currentUserId}`
      });
      unsubscribe({ table: 'orders', event: '*' });
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
