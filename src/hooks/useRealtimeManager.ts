'use client';

import { useRef, useCallback, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';

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
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2
};

// Control de logs basado en entorno
const isDevelopment = process.env.NODE_ENV === 'development';
const log = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
  // En producción, solo mostrar error
  // En desarrollo, mostrar solo error para reducir spam
  if (level === 'debug' || level === 'info' || level === 'warn') return;

  const prefix = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌'
  }[level];

  console[level](`${prefix} ${message}`, ...args);
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
      log('error', `Máximo de reintentos alcanzado para ${channelName}`);
      retryCounts.current.delete(channelName);
      return;
    }

    const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, currentRetries);
    
    log('warn', `Reintentando conexión ${channelName} en ${delay}ms (intento ${currentRetries + 1}/${retryConfig.maxRetries})`);
    
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
      log('debug', `Suscripción ${channelName} ya existe o está en proceso`);
      return;
    }

    try {
      isSubscribing.current.add(channelName);
      log('info', `Configurando suscripción Realtime para ${channelName}`);

             // Verificar que Supabase esté conectado con timeout
       try {
         const timeoutPromise = new Promise((_, reject) => 
           setTimeout(() => reject(new Error('Timeout')), 5000)
         );
         
         const connectionPromise = supabase.from(config.table).select('count').limit(1);
         
         const { data, error } = await Promise.race([connectionPromise, timeoutPromise]) as any;
         
         if (error) {
           log('error', `Error de conexión con Supabase para ${config.table}:`, error);
           throw new Error(`No se puede conectar a la tabla ${config.table}`);
         }
       } catch (error) {
         if (error instanceof Error && error.message === 'Timeout') {
           log('error', `Timeout conectando a Supabase para ${config.table}`);
         } else {
           log('error', `Error verificando conexión con Supabase para ${config.table}:`, error);
         }
         throw error;
       }

      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: channelName,
          },
          broadcast: {
            self: false,
          },
        },
      })
        .on(
          'postgres_changes',
          {
            event: config.event as any,
            schema: 'public',
            table: config.table,
            filter: config.filter
          },
          (payload) => {
            log('debug', `Realtime ${config.event.toUpperCase()} en ${config.table}:`, payload);
            
            // Aplicar debounce si está configurado
            if (options.debounceMs) {
              setTimeout(() => {
                try {
                  switch (config.event) {
                    case 'INSERT':
                      handlers.onInsert?.(payload);
                      break;
                    case 'UPDATE':
                      handlers.onUpdate?.(payload);
                      break;
                    case 'DELETE':
                      handlers.onDelete?.(payload);
                      break;
                                      default:
                    // Para eventos '*' manejar todos los tipos de forma segura
                    try {
                      if (payload.eventType === 'INSERT' && typeof handlers.onInsert === 'function') {
                        handlers.onInsert(payload);
                      } else if (payload.eventType === 'UPDATE' && typeof handlers.onUpdate === 'function') {
                        handlers.onUpdate(payload);
                      } else if (payload.eventType === 'DELETE' && typeof handlers.onDelete === 'function') {
                        handlers.onDelete(payload);
                      }
                    } catch (handlerError) {
                      log('error', `Error en handler de evento ${payload.eventType}:`, handlerError);
                    }
                    break;
                  }
                } catch (error) {
                  log('error', `Error en handler de ${config.event}:`, error);
                }
              }, options.debounceMs);
            } else {
              try {
                switch (config.event) {
                  case 'INSERT':
                    handlers.onInsert?.(payload);
                    break;
                  case 'UPDATE':
                    handlers.onUpdate?.(payload);
                    break;
                  case 'DELETE':
                    handlers.onDelete?.(payload);
                    break;
                  default:
                    // Para eventos '*' manejar todos los tipos de forma segura
                    try {
                      if (payload.eventType === 'INSERT' && typeof handlers.onInsert === 'function') {
                        handlers.onInsert(payload);
                      } else if (payload.eventType === 'UPDATE' && typeof handlers.onUpdate === 'function') {
                        handlers.onUpdate(payload);
                      } else if (payload.eventType === 'DELETE' && typeof handlers.onDelete === 'function') {
                        handlers.onDelete(payload);
                      }
                    } catch (handlerError) {
                      log('error', `Error en handler de evento ${payload.eventType}:`, handlerError);
                    }
                    break;
                }
              } catch (error) {
                log('error', `Error en handler de ${config.event}:`, error);
              }
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          log('debug', `Presencia sincronizada para ${channelName}`);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          log('debug', `Presencia join para ${channelName}:`, { key, newPresences });
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          log('debug', `Presencia leave para ${channelName}:`, { key, leftPresences });
        })
        .on('broadcast', { event: 'test' }, (payload) => {
          log('debug', `Broadcast test para ${channelName}:`, payload);
        })
        .subscribe((status) => {
          log('info', `Estado de suscripción ${channelName}:`, status);
          
          if (status === 'SUBSCRIBED') {
            log('info', `Suscripción ${channelName} establecida exitosamente`);
            isSubscribing.current.delete(channelName);
            retryCounts.current.delete(channelName);
            clearRetryTimeout(channelName);
          } else if (status === 'CLOSED') {
            log('info', `Suscripción ${channelName} cerrada intencionalmente`);
            subscriptions.current.delete(channelName);
            isSubscribing.current.delete(channelName);
            // No reintentar para cierres intencionales
          } else if (status === 'CHANNEL_ERROR') {
            log('warn', `Suscripción ${channelName} falló con error:`, status);
            subscriptions.current.delete(channelName);
            isSubscribing.current.delete(channelName);
            // Reintentar solo para errores de canal
            attemptReconnection(config, handlers, options);
          }
        });

      subscriptions.current.set(channelName, channel);
    } catch (error) {
      log('error', `Error configurando suscripción ${channelName}:`, error);
      isSubscribing.current.delete(channelName);
      attemptReconnection(config, handlers, options);
    }
  }, [attemptReconnection, clearRetryTimeout]);

  const unsubscribe = useCallback((config: SubscriptionConfig) => {
    const channelName = `${config.table}_${config.event}`;
    const channel = subscriptions.current.get(channelName);
    
    if (channel) {
      log('info', `Desconectando suscripción Realtime para ${channelName}`);
      channel.unsubscribe();
      subscriptions.current.delete(channelName);
      clearRetryTimeout(channelName);
      retryCounts.current.delete(channelName);
    }
  }, [clearRetryTimeout]);

  const unsubscribeAll = useCallback(() => {
    log('info', 'Desconectando todas las suscripciones Realtime');
    subscriptions.current.forEach((channel, channelName) => {
      log('debug', `Desconectando ${channelName}`);
      channel.unsubscribe();
      clearRetryTimeout(channelName);
    });
    subscriptions.current.clear();
    isSubscribing.current.clear();
    retryCounts.current.clear();
  }, [clearRetryTimeout]);

  // Limpiar suscripciones al desmontar
  useEffect(() => {
    return () => {
      unsubscribeAll();
    };
  }, [unsubscribeAll]);

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    getSubscriptionCount: () => subscriptions.current.size,
    getActiveSubscriptions: () => Array.from(subscriptions.current.keys())
  };
}
