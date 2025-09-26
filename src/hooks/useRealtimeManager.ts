'use client';

import React, { useRef, useCallback, useEffect } from 'react';
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
  maxRetries: 3, // 🔧 OPTIMIZACIÓN: Reducir reintentos para respuestas más rápidas
  retryDelay: 500, // 🔧 OPTIMIZACIÓN: Reducir delay inicial
  backoffMultiplier: 1.5
};

// 🔧 OPTIMIZACIÓN: Usar logging centralizado con control de nivel
const realtimeLog = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
  // Usar configuración centralizada de logging
  const { config } = require('../lib/config');
  const shouldLog = 
    (level === 'error' && config.logging.showErrorLogs) ||
    (level === 'warn' && config.logging.showDebugLogs) ||
    (level === 'info' && config.logging.showInfoLogs) ||
    (level === 'debug' && config.logging.showDebugLogs);
  
  if (shouldLog) {
    configLog(level, `[Realtime] ${message}`, ...args);
  }
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

      // console.log(`🔍 [RealtimeManager] Creando suscripción para ${channelName}`);

      // Crear el canal con configuración optimizada
      // console.log('🔍 [RealtimeManager] Creando canal:', channelName, 'con filtro:', config.filter);
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
            // console.log('🔍 [RealtimeManager] Evento recibido:', payload.eventType, 'en', channelName, 'para orden:', payload.new?.order_number);
            // Only log important events, not every single update
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
              realtimeLog('info', `Evento ${payload.eventType} en ${channelName}`);
            }
            
            // 🔧 OPTIMIZACIÓN: Debounce para evitar múltiples actualizaciones
            const debounceMs = options.debounceMs || 100; // Default debounce
            clearTimeout((global as any)[`debounce_${channelName}`]);
            (global as any)[`debounce_${channelName}`] = setTimeout(() => {
              if (payload.eventType === 'INSERT' && handlers.onInsert) {
                handlers.onInsert(payload);
              } else if (payload.eventType === 'UPDATE' && handlers.onUpdate) {
                handlers.onUpdate(payload);
              } else if (payload.eventType === 'DELETE' && handlers.onDelete) {
                handlers.onDelete(payload);
              }
            }, debounceMs);
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
            // 🔧 OPTIMIZACIÓN: Manejar errores de Realtime con reintentos limitados
            realtimeLog('warn', `Conexión Realtime falló para ${channelName}: ${status}`);
            isSubscribing.current.delete(channelName);
            subscriptions.current.delete(channelName);
            
            // Reintentar conexión para errores de canal (pueden ser temporales)
            attemptReconnection(config, handlers, options);
          }
        });

    } catch (error) {
      realtimeLog('error', `Error creando suscripción ${channelName}:`, error);
      isSubscribing.current.delete(channelName);
      
      // 🔧 OPTIMIZACIÓN: No reintentar errores de configuración de Supabase
      const isConfigError = error.message?.includes('transport') || 
                           error.message?.includes('constructor') ||
                           error.message?.includes('TypeError');
      
      if (!isConfigError) {
        attemptReconnection(config, handlers, options);
      } else {
        realtimeLog('warn', `Error de configuración detectado para ${channelName}, no reintentando`);
      }
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
