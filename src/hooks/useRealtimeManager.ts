'use client';

import { useRef, useCallback, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { config, log as configLog } from '../lib/config';

export interface RealtimeHandlers {
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export interface SubscriptionConfig {
  table: string;
  event: string;
  filter?: string;
}

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  retryDelay: 1000,
  backoffMultiplier: 1.5
};

// 🔧 OPTIMIZACIÓN: Usar logging centralizado
const realtimeLog = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
  configLog(level, `[Realtime] ${message}`, ...args);
};

export function useRealtimeManager() {
  const subscriptions = useRef<Map<string, RealtimeChannel>>(new Map());
  const isSubscribing = useRef<Set<string>>(new Set());
  const retryCounts = useRef<Map<string, number>>(new Map());
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearRetryTimeout = useCallback((channelName: string) => {
    const timeout = retryTimeouts.current.get(channelName);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeouts.current.delete(channelName);
    }
  }, []);

  const attemptReconnection = useCallback(async (
    config: SubscriptionConfig,
    handlers: RealtimeHandlers,
    options: { debounceMs?: number; retryConfig?: RetryConfig } = {}
  ) => {
    const channelName = `${config.table}_${config.event}`;
    const retryConfig = options.retryConfig || DEFAULT_RETRY_CONFIG;
    const currentRetries = retryCounts.current.get(channelName) || 0;

    if (currentRetries >= retryConfig.maxRetries) {
      realtimeLog('error', `Máximo de reintentos alcanzado para ${channelName}`);
      retryCounts.current.delete(channelName);
      return;
    }

    const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, currentRetries);
    
    realtimeLog('warn', `Reintentando conexión ${channelName} en ${delay}ms (intento ${currentRetries + 1}/${retryConfig.maxRetries})`);
    
    const timeout = setTimeout(async () => {
      retryTimeouts.current.delete(channelName);
      await subscribe(config, handlers, options);
    }, delay);
    
    retryTimeouts.current.set(channelName, timeout);
    retryCounts.current.set(channelName, currentRetries + 1);
  }, []);

  const subscribe = useCallback(async (
    config: SubscriptionConfig,
    handlers: RealtimeHandlers,
    options: { debounceMs?: number; retryConfig?: RetryConfig } = {}
  ) => {
    const channelName = `${config.table}_${config.event}`;
    
    // Evitar suscripciones duplicadas
    if (subscriptions.current.has(channelName) || isSubscribing.current.has(channelName)) {
      configLog('debug', `Suscripción ${channelName} ya existe o está en proceso`);
      return;
    }

    isSubscribing.current.add(channelName);
    clearRetryTimeout(channelName);

    try {
      // 🔧 OPTIMIZACIÓN: Verificar conexión antes de suscribirse
      const { data: connectionTest, error: connectionError } = await supabase
        .from(config.table)
        .select('count')
        .limit(1);

      if (connectionError) {
        realtimeLog('error', `Error de conexión con ${config.table}:`, connectionError);
        throw new Error(`No se puede conectar a la tabla ${config.table}`);
      }

      realtimeLog('info', `Creando suscripción para ${channelName}`);

      // Crear el canal con configuración optimizada
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as any,
          {
            event: config.event,
            schema: 'public',
            table: config.table,
            filter: config.filter
          },
          (payload: any) => {
            realtimeLog('debug', `Evento recibido en ${channelName}:`, payload);
            
            // 🔧 OPTIMIZACIÓN: Debounce para evitar múltiples actualizaciones
            if (options.debounceMs) {
              clearTimeout((global as any)[`debounce_${channelName}`]);
              (global as any)[`debounce_${channelName}`] = setTimeout(() => {
                if (payload.eventType === 'INSERT' && handlers.onInsert) {
                  handlers.onInsert(payload);
                } else if (payload.eventType === 'UPDATE' && handlers.onUpdate) {
                  handlers.onUpdate(payload);
                } else if (payload.eventType === 'DELETE' && handlers.onDelete) {
                  handlers.onDelete(payload);
                }
              }, options.debounceMs);
            } else {
              // Sin debounce
              if (payload.eventType === 'INSERT' && handlers.onInsert) {
                handlers.onInsert(payload);
              } else if (payload.eventType === 'UPDATE' && handlers.onUpdate) {
                handlers.onUpdate(payload);
              } else if (payload.eventType === 'DELETE' && handlers.onDelete) {
                handlers.onDelete(payload);
              }
            }
          }
        )
        .subscribe((status) => {
          realtimeLog('info', `Estado de suscripción ${channelName}:`, status);
          
          if (status === 'SUBSCRIBED') {
            subscriptions.current.set(channelName, channel);
            isSubscribing.current.delete(channelName);
            retryCounts.current.delete(channelName);
            realtimeLog('info', `✅ Suscripción ${channelName} activa`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // 🔧 OPTIMIZACIÓN: Manejar errores de Realtime sin reintentos infinitos
            realtimeLog('warn', `Conexión Realtime falló para ${channelName}: ${status}`);
            isSubscribing.current.delete(channelName);
            subscriptions.current.delete(channelName);
            
            // Solo reintentar si no es un error de configuración
            if (status !== 'CHANNEL_ERROR') {
              attemptReconnection(config, handlers, options);
            }
          }
        });

    } catch (error) {
      realtimeLog('error', `Error creando suscripción ${channelName}:`, error);
      isSubscribing.current.delete(channelName);
      attemptReconnection(config, handlers, options);
    }
  }, [clearRetryTimeout, attemptReconnection]);

  const unsubscribe = useCallback((config: SubscriptionConfig) => {
    const channelName = `${config.table}_${config.event}`;
    
    clearRetryTimeout(channelName);
    isSubscribing.current.delete(channelName);
    retryCounts.current.delete(channelName);
    
    const channel = subscriptions.current.get(channelName);
    if (channel) {
      realtimeLog('info', `Desuscribiendo ${channelName}`);
      supabase.removeChannel(channel);
      subscriptions.current.delete(channelName);
    }
  }, [clearRetryTimeout]);

  // 🔧 OPTIMIZACIÓN: Cleanup al desmontar
  useEffect(() => {
    return () => {
      realtimeLog('info', 'Limpiando todas las suscripciones Realtime');
      subscriptions.current.forEach((channel, channelName) => {
        realtimeLog('debug', `Desuscribiendo ${channelName}`);
        supabase.removeChannel(channel);
      });
      subscriptions.current.clear();
      isSubscribing.current.clear();
      retryCounts.current.clear();
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
      retryTimeouts.current.clear();
    };
  }, []);

  return { subscribe, unsubscribe };
}
