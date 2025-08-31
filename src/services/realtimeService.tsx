'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRealtimeManager } from '../hooks/useRealtimeManager';

// Tipos
interface RealtimeMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'sent' | 'received';
  contact_id: string;
  status: string;
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
  
  const messageListeners = useRef<Set<(message: RealtimeMessage) => void>>(new Set());
  const orderListeners = useRef<Set<(order: RealtimeOrder) => void>>(new Set());
  
  const { subscribe, unsubscribe } = useRealtimeManager();

  // Handlers para mensajes
  const handleNewMessage = (payload: any) => {
    const newMessage = payload.new;
    if (newMessage) {
      const message: RealtimeMessage = {
        id: newMessage.id,
        content: newMessage.content,
        timestamp: new Date(newMessage.timestamp),
        type: newMessage.message_type,
        contact_id: newMessage.contact_id,
        status: newMessage.status || 'delivered'
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
      setMessages(prev => 
        prev.filter(msg => msg.id !== deletedMessage.id)
      );
    }
  };

  // Handlers para órdenes
  const handleNewOrder = (payload: any) => {
    const newOrder = payload.new;
    if (newOrder) {
      const order: RealtimeOrder = {
        id: newOrder.id,
        status: newOrder.status
      };
      
      setOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        if (exists) return prev;
        return [...prev, order];
      });
      
      orderListeners.current.forEach(callback => {
        try {
          callback(order);
        } catch (error) {
          console.error('Error en order listener:', error);
        }
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
            : order
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

  // Configurar suscripciones Realtime
  useEffect(() => {
    subscribe(
      { table: 'whatsapp_messages', event: '*' },
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
      unsubscribe({ table: 'whatsapp_messages', event: '*' });
      unsubscribe({ table: 'orders', event: '*' });
    };
  }, [subscribe, unsubscribe]);

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
    isConnected
  };

  return (
    <RealtimeServiceContext.Provider value={value}>
      {children}
    </RealtimeServiceContext.Provider>
  );
}
