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
        maxRetries: 5,
        retryDelay: 2000,
        backoffMultiplier: 1.5
      }
    }
  );
}

// Hook específico para órdenes
export function useOrdersRealtime(
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  return useRealtimeSubscription(
    {
      table: 'orders',
      event: '*'
    },
    {
      onInsert,
      onUpdate,
      onDelete,
      debounceMs: 300,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      }
    }
  );
}

// Hook específico para pedidos pendientes
export function usePendingOrdersRealtime(
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  return useRealtimeSubscription(
    {
      table: 'pending_orders',
      event: '*'
    },
    {
      onInsert,
      onUpdate,
      onDelete,
      debounceMs: 150,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      }
    }
  );
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
