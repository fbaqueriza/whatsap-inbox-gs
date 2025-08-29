'use client';

import { useEffect, useRef } from 'react';
import { useRealtimeManager, SubscriptionConfig, RealtimeHandlers } from './useRealtimeManager';

// Hook genérico para suscripciones Realtime
export function useRealtimeSubscription(
  config: SubscriptionConfig,
  handlers: RealtimeHandlers & { debounceMs?: number; retryConfig?: any }
) {
  const { subscribe, unsubscribe } = useRealtimeManager();
  const isSubscribed = useRef(false);

  useEffect(() => {
    if (!isSubscribed.current) {
      subscribe(config, handlers, { 
        debounceMs: handlers.debounceMs,
        retryConfig: handlers.retryConfig
      });
      isSubscribed.current = true;
    }

    return () => {
      if (isSubscribed.current) {
        unsubscribe(config);
        isSubscribed.current = false;
      }
    };
  }, [config.table, config.event, config.filter, subscribe, unsubscribe]);

  return { isSubscribed: isSubscribed.current };
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
      onInsert,
      onUpdate,
      onDelete,
      debounceMs: 100, // 🔧 OPTIMIZACIÓN: Reducido para actualización más rápida
      retryConfig: {
        maxRetries: 3, // 🔧 OPTIMIZACIÓN: Reducir reintentos para evitar spam
        retryDelay: 1000, // 🔧 OPTIMIZACIÓN: Delay más largo
        backoffMultiplier: 2 // 🔧 OPTIMIZACIÓN: Backoff más agresivo
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
