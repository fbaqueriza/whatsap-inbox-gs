'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRealtimeManager, SubscriptionConfig, RealtimeHandlers } from './useRealtimeManager';
import { supabase } from '../lib/supabase/client';

// Hook genérico para suscripciones de Realtime
export function useRealtimeSubscription(
  config: { table: string; event: string; filter?: string },
  handlers: {
    onInsert?: (payload: any) => void;
    onUpdate?: (payload: any) => void;
    onDelete?: (payload: any) => void;
    debounceMs?: number;
    retryConfig?: any;
  }
) {
  const { subscribe, unsubscribe } = useRealtimeManager();
  const isSubscribed = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  useEffect(() => {
    // 🔧 OPTIMIZACIÓN: Verificar si Realtime está habilitado
    const isRealtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== 'false';
    
    if (!isRealtimeEnabled) {
      console.log('⚠️ Realtime deshabilitado por configuración');
      setConnectionStatus('disconnected');
      return;
    }

    if (!isSubscribed.current) {
      setConnectionStatus('connecting');
      try {
        subscribe(config, handlers, { 
          debounceMs: handlers.debounceMs,
          retryConfig: handlers.retryConfig
        });
        isSubscribed.current = true;
        setConnectionStatus('connected');
        // console.log('✅ Realtime funcionando correctamente');
      } catch (error) {
        console.error('❌ Error estableciendo suscripción Realtime:', error);
        setConnectionStatus('error');
        isSubscribed.current = false;
      }
    }

    return () => {
      if (isSubscribed.current) {
        unsubscribe(config);
        isSubscribed.current = false;
        setConnectionStatus('disconnected');
      }
    };
  }, [config.table, config.event, config.filter, subscribe, unsubscribe]);

  // 🔧 OPTIMIZACIÓN: Verificación mejorada de estado de conexión
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // 🔧 MEJORA: Verificar directamente la conexión de Supabase con timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        const connectionPromise = supabase
          .from('orders')
          .select('count')
          .limit(1);
        
        const { data, error } = await Promise.race([connectionPromise, timeoutPromise]) as any;
        
        if (error) {
          console.log('⚠️ Error de conexión con Supabase:', error.message);
          setConnectionStatus('error');
          isSubscribed.current = false;
          return;
        }
        
        // 🔧 MEJORA: Verificar si Realtime está habilitado
        const isRealtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== 'false';
        
        if (!isRealtimeEnabled) {
          console.log('ℹ️ Realtime deshabilitado por configuración');
          setConnectionStatus('disconnected');
          isSubscribed.current = false;
          return;
        }
        
        // 🔧 MEJORA: Verificar estado de la suscripción
        if (isSubscribed.current && connectionStatus !== 'connected') {
                  // console.log('✅ Suscripción Realtime establecida para:', config.table);
        setConnectionStatus('connected');
        }
        
      } catch (error) {
        console.error('❌ Error verificando estado de Realtime:', error);
        setConnectionStatus('error');
        isSubscribed.current = false;
      }
    };

    // 🔧 MEJORA: Verificar cada 60 segundos para reducir carga
    const interval = setInterval(checkConnection, 60000);
    checkConnection(); // Verificar inmediatamente

    return () => clearInterval(interval);
  }, [connectionStatus]);

  return { 
    isSubscribed: isSubscribed.current && connectionStatus === 'connected',
    connectionStatus 
  };
}

// Hook específico para mensajes de WhatsApp
export function useWhatsAppMessagesRealtime(
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  return useRealtimeSubscription(
    {
      table: 'whatsapp_messages',
      event: '*'
    },
    {
      onInsert,
      onUpdate,
      onDelete,
      debounceMs: 150,
      retryConfig: {
        maxRetries: 3, // 🔧 OPTIMIZACIÓN: Reducir reintentos
        retryDelay: 5000, // 🔧 OPTIMIZACIÓN: Aumentar delay inicial
        backoffMultiplier: 2 // 🔧 OPTIMIZACIÓN: Backoff más agresivo
      }
    }
  );
}

// Hook específico para órdenes con optimización para tiempo real
export function useOrdersRealtime(
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  // 🔧 OPTIMIZACIÓN: Verificar si Realtime está habilitado
  const isRealtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== 'false';
  
  if (!isRealtimeEnabled) {
    // Retornar un hook simulado si Realtime está deshabilitado
    return { isSubscribed: false };
  }

  return useRealtimeSubscription(
    {
      table: 'orders',
      event: '*'
    },
    {
      onInsert: (payload) => {
        console.log('🆕 Realtime: Nueva orden detectada:', payload.new?.id);
        // 🔧 MEJORA: Validar que la orden tenga datos válidos
        if (payload.new && payload.new.id && payload.new.user_id) {
          console.log('✅ Orden válida, procesando inserción...');
          onInsert?.(payload);
        } else {
          console.log('⚠️ Orden inválida, ignorando:', payload.new);
        }
      },
      onUpdate: (payload) => {
        console.log('🔄 Realtime: Orden actualizada:', payload.new?.id, 'Estado:', payload.new?.status);
        // 🔧 MEJORA: Solo procesar si hay cambios reales
        if (payload.new && payload.old && 
            (payload.new.status !== payload.old.status || 
             payload.new.total_amount !== payload.old.total_amount ||
             payload.new.updated_at !== payload.old.updated_at)) {
          console.log('✅ Cambios detectados, procesando actualización...');
          onUpdate?.(payload);
        } else {
          console.log('ℹ️ Sin cambios relevantes, ignorando actualización');
        }
      },
      onDelete: (payload) => {
        console.log('🗑️ Realtime: Orden eliminada:', payload.old?.id);
        if (payload.old && payload.old.id) {
          onDelete?.(payload);
        }
      },
      debounceMs: 50, // 🔧 OPTIMIZACIÓN: Reducido para mayor responsividad
      retryConfig: {
        maxRetries: 3,
        retryDelay: 500,
        backoffMultiplier: 1.5
      }
    }
  );
}

// 🔧 OPTIMIZACIÓN: Hook específico para pedidos pendientes con configuración mejorada
export function usePendingOrdersRealtime(
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  // 🔧 MEJORA: Suscripción múltiple para ambas tablas
  const pendingOrdersSubscription = useRealtimeSubscription(
    {
      table: 'pending_orders',
      event: '*'
    },
    {
      onInsert,
      onUpdate,
      onDelete,
      debounceMs: 100, // Reducido para mejor responsividad
      retryConfig: {
        maxRetries: 5,
        retryDelay: 500,
        backoffMultiplier: 1.2
      }
    }
  );

  // 🔧 MEJORA: Suscripción adicional para órdenes con estado 'pending'
  const ordersSubscription = useRealtimeSubscription(
    {
      table: 'orders',
      event: '*',
      filter: 'status=eq.pending' // Filtrar solo órdenes pendientes
    },
    {
      onInsert: (payload) => {
        // Solo procesar si el estado es 'pending'
        if (payload.new?.status === 'pending') {
          onInsert?.(payload);
        }
      },
      onUpdate: (payload) => {
        // Procesar cambios de estado
        if (payload.new?.status === 'pending' || payload.old?.status === 'pending') {
          onUpdate?.(payload);
        }
      },
      onDelete: (payload) => {
        // Procesar eliminaciones de órdenes pendientes
        if (payload.old?.status === 'pending') {
          onDelete?.(payload);
        }
      },
      debounceMs: 100,
      retryConfig: {
        maxRetries: 5,
        retryDelay: 500,
        backoffMultiplier: 1.2
      }
    }
  );

  return {
    isSubscribed: pendingOrdersSubscription.isSubscribed && ordersSubscription.isSubscribed
  };
}

// Hook específico para templates
export function useTemplatesRealtime(
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  return useRealtimeSubscription(
    {
      table: 'whatsapp_templates',
      event: '*'
    },
    {
      onInsert,
      onUpdate,
      onDelete,
      debounceMs: 500,
      retryConfig: {
        maxRetries: 2,
        retryDelay: 3000,
        backoffMultiplier: 2
      }
    }
  );
}

  // 🔧 OPTIMIZACIÓN: Hook específico para el flujo completo de órdenes
  export function useOrdersFlowRealtime(
    onOrderCreated?: (payload: any) => void,
    onOrderStatusChanged?: (payload: any) => void,
    onOrderDeleted?: (payload: any) => void
  ) {
    // 🔧 MEJORA: Verificar si Realtime está habilitado
    const isRealtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== 'false';

    // 🔧 OPTIMIZACIÓN: Reducir logging para evitar spam y múltiples inicializaciones
    const [hasLogged, setHasLogged] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    
    useEffect(() => {
      if (!hasLogged && !isInitialized) {
        // console.log('🔧 useOrdersFlowRealtime: Inicializando...', { isRealtimeEnabled });
        setHasLogged(true);
        setIsInitialized(true);
      }
    }, [hasLogged, isRealtimeEnabled, isInitialized]);

    if (!isRealtimeEnabled) {
      // Retornar un hook simulado si Realtime está deshabilitado
      return {
        isSubscribed: false,
        ordersSubscribed: false,
        connectionStatus: 'disconnected' as const
      };
    }

  // Suscripción para órdenes con filtros específicos
  const ordersSubscription = useRealtimeSubscription(
    {
      table: 'orders',
      event: '*'
    },
    {
      onInsert: (payload) => {
        console.log('🆕 Nueva orden creada:', payload.new?.id);
        // 🔧 MEJORA: Validar datos antes de procesar
        if (payload.new && payload.new.id && payload.new.user_id) {
          onOrderCreated?.(payload);
        }
      },
      onUpdate: (payload) => {
        // Solo procesar cambios de estado
        if (payload.new?.status !== payload.old?.status) {
          console.log('🔄 Estado de orden cambiado:', {
            orderId: payload.new?.id,
            oldStatus: payload.old?.status,
            newStatus: payload.new?.status
          });
          // 🔧 MEJORA: Validar que el cambio sea válido
          if (payload.new && payload.new.id) {
            onOrderStatusChanged?.(payload);
          }
        }
      },
      onDelete: (payload) => {
        console.log('🗑️ Orden eliminada:', payload.old?.id);
        if (payload.old && payload.old.id) {
          onOrderDeleted?.(payload);
        }
      },
      debounceMs: 150, // 🔧 OPTIMIZACIÓN: Balance entre responsividad y estabilidad
      retryConfig: {
        maxRetries: 5,
        retryDelay: 1000,
        backoffMultiplier: 1.5
      }
    }
  );

  return {
    isSubscribed: ordersSubscription.isSubscribed,
    ordersSubscribed: ordersSubscription.isSubscribed,
    connectionStatus: ordersSubscription.connectionStatus
  };
}
