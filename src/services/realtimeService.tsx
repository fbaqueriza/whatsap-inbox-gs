'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { mapOrderFromDb } from '../lib/orderMapper';
import { supabase } from '../lib/supabase/client';
import { normalizePhoneNumber } from '../lib/phoneNormalization';

// Tipos
interface RealtimeMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: string;
  contact_id: string;
  status: string;
  user_id?: string;
  // ✅ CORRECCIÓN RAÍZ: Agregar message_type para identificar correctamente el tipo
  message_type?: 'received' | 'sent';
  // 🔧 CORRECCIÓN: Agregar campos para documentos
  media_url?: string;
  media_type?: string;
}

interface RealtimeOrder {
  id: string;
  status: string;
  orderNumber?: string;
  totalAmount?: number;
  invoiceNumber?: string;
  receiptUrl?: string;
  invoiceData?: any;
  updatedAt?: string;
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

  // Referencias para control de actualizaciones
  const lastOrdersUpdateRef = useRef<string>('');

  const messageListeners = useRef<Set<(message: RealtimeMessage) => void>>(new Set());
  const orderListeners = useRef<Set<(order: RealtimeOrder) => void>>(new Set());

  // Referencias para suscripciones
  const subscriptionsRef = useRef<Set<any>>(new Set());


  // 🔧 CORREGIDO: Ya no necesitamos este useEffect porque currentUserId viene de useSupabaseAuth

  // Handlers para mensajes
  const handleNewMessage = async (payload: any) => {
    const newMessage = payload.new;
    // Silenciado logs

    if (!newMessage || !currentUserId) {
      // Silenciado
      return;
    }

    // 🔧 LÓGICA SIMPLIFICADA: Aceptar mensajes del usuario actual O mensajes sin user_id
    const isValidMessage = newMessage.user_id === currentUserId || !newMessage.user_id;

    // Silenciado

    if (!isValidMessage) {
      // Silenciado
      return; // Ignorar mensaje no válido
    }

    // ✅ CORRECCIÓN RAÍZ: Crear mensaje y notificar listeners
    // ✅ CORRECCIÓN RAÍZ: Normalizar contact_id para evitar contactos duplicados
    const normalizedContactId = normalizePhoneNumber(newMessage.contact_id).normalized;
    
    const message: RealtimeMessage = {
      id: newMessage.id,
      content: newMessage.content,
      timestamp: new Date(newMessage.timestamp),
      // ✅ CORRECCIÓN: Usar message_type del mensaje de la BD
      type: newMessage.message_type || 'text',
      contact_id: normalizedContactId, // Usar número normalizado
      status: newMessage.status || 'delivered',
      user_id: newMessage.user_id,
      // 🔧 CORRECCIÓN: Incluir media_url y media_type para documentos
      media_url: newMessage.media_url,
      media_type: newMessage.media_type
    };

    setMessages(prev => {
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) { return prev; }
      return [...prev, message];
    });

    // 🔧 OPTIMIZACIÓN: Notificar a todos los listeners de forma segura
    // Silenciado
    messageListeners.current.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error en message listener:', error);
      }
    });
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
      // Silenciado
      return;
    }

    // 🔧 OPTIMIZACIÓN: Filtrar nuevas órdenes por user_id
    if (newOrder.user_id && newOrder.user_id !== currentUserId) {
      // Silenciado
      return;
    }

    // Mapear la orden antes de agregarla
    const mappedOrder = mapOrderFromDb(newOrder);

    setOrders(prev => {
      const exists = prev.some(order => order.id === mappedOrder.id);
      if (exists) return prev;
      return [...prev, mappedOrder];
    });

    // 🔧 OPTIMIZACIÓN: Notificar a los listeners sobre la nueva orden
    orderListeners.current.forEach(callback => {
      try {
        callback(mappedOrder);
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
    
    setOrders(prev => {
      const existingIndex = prev.findIndex(order => order.id === updatedOrder.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...mappedOrder };
        return updated;
      } else {
        return [mappedOrder, ...prev];
      }
    });

    // Notificar a los listeners sobre la actualización (esto es lo que DataProvider escucha)
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
      // Silenciado
      return;
    }

    // 🔧 OPTIMIZACIÓN: Filtrar eliminaciones por user_id
    if (deletedOrder.user_id && deletedOrder.user_id !== currentUserId) {
      // Silenciado
      return;
    }

    setOrders(prev =>
      prev.filter(order => order.id !== deletedOrder.id)
    );
  };

  // 🔧 NUEVO: Handlers para eventos de Kapso
  const handleKapsoOrderUpdate = (payload: any) => {
    if (!currentUserId) {
      return;
    }

    const orderId = payload.payload?.orderId;
    if (!orderId) {
      return;
    }

    // Buscar la orden en el estado actual y actualizarla
    setOrders(prev => {
      const updated = prev.map(order => {
        if (order.id === orderId) {
          const updateData: any = {
            ...order,
            status: payload.payload.status || order.status,
            updatedAt: payload.payload.timestamp ? new Date(payload.payload.timestamp) : order.updatedAt
          };
          if (payload.payload.receiptUrl !== undefined) {
            updateData.receiptUrl = payload.payload.receiptUrl;
          }
          if (payload.payload.totalAmount !== undefined) {
            updateData.totalAmount = payload.payload.totalAmount;
          }
          if (payload.payload.invoiceNumber !== undefined) {
            updateData.invoiceNumber = payload.payload.invoiceNumber;
          }
          if (payload.payload.invoiceDate !== undefined) {
            updateData.invoiceDate = payload.payload.invoiceDate ? new Date(payload.payload.invoiceDate) : undefined;
          }
          return updateData;
        }
        return order;
      });
      return updated;
    });

    // Notificar a los listeners
    orderListeners.current.forEach(callback => {
      try {
        const updatedOrder: any = { 
          id: orderId, 
          status: payload.payload.status,
          source: payload.payload.source || 'invoice_ocr'
        };
        if (payload.payload.receiptUrl !== undefined) {
          updatedOrder.receiptUrl = payload.payload.receiptUrl;
        }
        if (payload.payload.totalAmount !== undefined) {
          updatedOrder.totalAmount = payload.payload.totalAmount;
        }
        if (payload.payload.invoiceNumber !== undefined) {
          updatedOrder.invoiceNumber = payload.payload.invoiceNumber;
        }
        if (payload.payload.invoiceDate !== undefined) {
          updatedOrder.invoiceDate = payload.payload.invoiceDate;
        }
        callback(updatedOrder);
      } catch (error) {
        console.error('❌ [RealtimeService] Error en order listener:', error);
      }
    });
  };

  // 🆕 NUEVO: Manejar creación de orden desde factura
  const handleKapsoOrderCreate = (payload: any) => {
    // 🔧 LIMPIEZA: Log removido
    
    if (!currentUserId) {
      // 🔧 LIMPIEZA: Log removido
      return;
    }

    // Crear objeto de orden completo desde el payload
    const newOrder: any = {
      id: payload.payload.orderId,
      orderNumber: payload.payload.orderNumber,
      providerId: payload.payload.providerId,
      status: payload.payload.status,
      items: payload.payload.items || [],
      receiptUrl: payload.payload.receiptUrl,
      totalAmount: payload.payload.totalAmount,
      currency: payload.payload.currency || 'ARS',
      invoiceNumber: payload.payload.invoiceNumber,
      invoiceDate: payload.payload.invoiceDate ? new Date(payload.payload.invoiceDate) : undefined,
      orderDate: payload.payload.orderDate || payload.payload.timestamp,
      updatedAt: payload.payload.timestamp,
      createdAt: payload.payload.timestamp,
      source: payload.payload.source || 'invoice_auto_create'
    };
    
    // Agregar la orden al estado si no existe
    setOrders(prev => {
      const exists = prev.some(order => order.id === newOrder.id);
      if (exists) {
        // 🔧 LIMPIEZA: Log removido
        return prev;
      }
      // 🔧 LIMPIEZA: Log removido
      return [...prev, newOrder];
    });

    // Notificar a los listeners
    orderListeners.current.forEach(callback => {
      try {
        callback(newOrder);
      } catch (error) {
        console.error('❌ [RealtimeService] Error en order listener (Kapso create):', error);
      }
    });
  };

  // ✅ COMENTADO: Esta función causaba duplicación de eventos de mensajes
  // Los mensajes ahora los maneja exclusivamente ChatContext
  // const handleKapsoMessageUpdate = (payload: any) => {
  //   console.log(`📨 [RealtimeService] Procesando mensaje desde Kapso:`, payload);
  //   
  //   if (!currentUserId) {
  //     console.log(`⚠️ [RealtimeService] Ignorando mensaje de Kapso - usuario no autenticado`);
  //     return;
  //   }

  //   // Crear mensaje desde el evento de Kapso
  //   const message: RealtimeMessage = {
  //     id: payload.payload.messageId,
  //     content: payload.payload.content,
  //     timestamp: new Date(payload.payload.timestamp),
  //     type: 'text',
  //     contact_id: payload.payload.from,
  //     status: 'delivered',
  //     user_id: currentUserId,
  //     source: 'kapso'
  //   };

  //   setMessages(prev => {
  //     const exists = prev.some(msg => msg.id === message.id);
  //     if (exists) {
  //       console.log('🔄 [RealtimeService] Mensaje de Kapso ya existe, ignorando:', message.id);
  //       return prev;
  //     }
  //     console.log('✅ [RealtimeService] Agregando mensaje de Kapso:', message.id);
  //     return [...prev, message];
  //   });

  //   // Notificar a los listeners
  //   messageListeners.current.forEach(callback => {
  //     try {
  //       callback(message);
  //     } catch (error) {
  //       console.error('❌ [RealtimeService] Error en message listener (Kapso):', error);
  //     }
  //   });
  // };

  const handleKapsoDocumentUpdate = (payload: any) => {
    console.log(`📎 [RealtimeService] Procesando documento desde Kapso:`, payload);
    // Aquí podrías actualizar el estado de documentos si es necesario
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
      
      // 🔧 REMOVIDO: No notificar órdenes iniciales - causaba logs duplicados y no es necesario
      // DataProvider carga las órdenes directamente con fetchAll
    } catch (error) {
      console.error('❌ [RealtimeService] Error inesperado cargando órdenes:', error);
    }
  }, [currentUserId]);

  // 🔧 OPTIMIZACIÓN: Configurar suscripciones una sola vez por usuario
  const subscriptionsInitializedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!currentUserId) {
      // Silenciado
      setIsConnected(false);
      return;
    }

    // ✅ SOLUCIÓN: Evitar crear múltiples suscripciones para el mismo usuario
    if (subscriptionsInitializedRef.current.has(currentUserId)) {
      return;
    }

    subscriptionsInitializedRef.current.add(currentUserId);
    
    // Silenciado
    setIsConnected(true);

    // 🔧 CARGAR ÓRDENES INICIALES
    loadInitialOrders();

    // 🔧 SOLUCIÓN OPTIMIZADA: Una sola llamada de suscripción por tipo
    const setupWhatsAppSuscription = async () => {
      try {
        // Silenciado
        // 🔧 FIX: Agregar filtro por user_id para que RLS permita los mensajes
        const channel = supabase
          .channel('whatsapp-messages')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'whatsapp_messages'
              // ✅ CORRECCIÓN: Remover filtro para que funcione con RLS
            }, 
            (payload) => {
              // Silenciado
              if (payload.eventType === 'INSERT') handleNewMessage(payload);
              else if (payload.eventType === 'UPDATE') handleMessageUpdate(payload);
              else if (payload.eventType === 'DELETE') handleMessageDelete(payload);
            }
          )
          .subscribe();
        
        subscriptionsRef.current.add(channel);
        setIsConnected(true);
        // Silenciado
      } catch (error) {
        console.error(`❌ RealtimeService: Error configurando suscripción a whatsapp_messages:`, error);
        setIsConnected(false);
      }
    };

    setupWhatsAppSuscription();

    // 🔧 SOLUCIÓN OPTIMIZADA: Suscripción a órdenes sin filtro (filtrar en handler)
    const setupOrdersSuscription = async () => {
      try {
        const channel = supabase
          .channel('orders-realtime')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'orders'
            }, 
            (payload) => {
              try {
                if (payload.eventType === 'INSERT') {
                  handleNewOrder(payload);
                } else if (payload.eventType === 'UPDATE') {
                  handleOrderUpdate(payload);
                } else if (payload.eventType === 'DELETE') {
                  handleOrderDelete(payload);
                }
              } catch (error) {
                console.error('❌ [RealtimeService] Error manejando evento:', error);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ [RealtimeService] Suscripción a orders ACTIVA');
              setIsConnected(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('❌ [RealtimeService] Error en suscripción orders:', status);
              setIsConnected(false);
            }
          });
        
        subscriptionsRef.current.add(channel);
      } catch (error) {
        console.error(`❌ [RealtimeService] Error configurando suscripción a orders:`, error);
      }
    };

    setupOrdersSuscription();

    // 🔧 NUEVO: Suscripción a eventos de Kapso
    const setupKapsoEventsSuscription = async () => {
      try {
        
        // Suscripción a eventos de órdenes de Kapso
        const ordersChannel = supabase
          .channel('orders-updates')
          .on('broadcast', { event: 'order_updated' }, (payload) => {
            console.log('🔄 [RealtimeService] Broadcast order_updated recibido:', payload);
            // Procesar evento de Kapso como si fuera un evento nativo de Supabase
            handleKapsoOrderUpdate(payload);
          })
          .on('broadcast', { event: 'order_created' }, (payload) => {
            console.log('🆕 [RealtimeService] Broadcast order_created recibido:', payload);
            // Procesar nueva orden creada desde factura
            handleKapsoOrderCreate(payload);
          })
          .subscribe();

        // ✅ CORRECCIÓN: No suscribirse a eventos de mensajes aquí - ChatContext lo maneja
        // Los mensajes de chat los maneja ChatContext directamente via 'kapso_messages' channel
        // Esta suscripción causaba duplicación de eventos

        // Suscripción a eventos de documentos de Kapso
        const documentsChannel = supabase
          .channel('documents-updates')
          .on('broadcast', { event: 'document_processed' }, (payload) => {
            // Silenciado
            handleKapsoDocumentUpdate(payload);
          })
          .subscribe();
      } catch (error) {
        console.error(`❌ [RealtimeService] Error configurando suscripciones de Kapso:`, error);
      }
    };

    setupKapsoEventsSuscription();




    return () => {
      // ✅ SOLUCIÓN: Limpiar suscripciones cuando el usuario cambie
      if (currentUserId && subscriptionsInitializedRef.current.has(currentUserId)) {
        // Silenciado
        
        // Remover del conjunto de usuarios inicializados
        subscriptionsInitializedRef.current.delete(currentUserId);
        
        // Desuscribir todos los canales
        subscriptionsRef.current.forEach(channel => {
          supabase.removeChannel(channel);
        });
        subscriptionsRef.current.clear();
      }
    };
  }, [currentUserId]);

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