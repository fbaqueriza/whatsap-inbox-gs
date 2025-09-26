/**
 * 🔧 REFACTORIZACIÓN COMPLETA: Hook unificado y optimizado para real-time
 * Elimina bucles infinitos y dependencias circulares
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase/client';
import { ORDER_STATUS } from '../lib/orderConstants';

export interface RealtimeConfig {
  debounceMs?: number;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  enableLogs?: boolean;
}

export interface RealtimeCallbacks {
  onOrderCreated?: (order: any) => void;
  onOrderUpdated?: (order: any) => void;
  onOrderDeleted?: (orderId: string) => void;
  onStatusChanged?: (orderId: string, oldStatus: string, newStatus: string) => void;
}

// 🔧 SINGLETON: Instancia global para evitar múltiples suscripciones
let globalSubscription: any = null;
let globalRetryCount = 0;
let globalIsConnecting = false;

export function useOptimizedRealtime(
  callbacks: RealtimeCallbacks = {},
  config: RealtimeConfig = {}
) {
  const {
    debounceMs = 150,
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 1.5,
    enableLogs = false
  } = config;

  const lastUpdateRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // 🔧 MEMOIZAR CALLBACKS para evitar re-renders innecesarios
  const memoizedCallbacks = useMemo(() => callbacks, [
    callbacks.onOrderCreated,
    callbacks.onOrderUpdated,
    callbacks.onOrderDeleted,
    callbacks.onStatusChanged
  ]);

  // 🔧 FUNCIÓN DE LOGGING CONDICIONAL
  const log = useCallback((level: 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
    if (!enableLogs) return;
    
    const prefix = {
      info: '📡',
      warn: '⚠️',
      error: '❌'
    }[level];
    
    console[level](`${prefix} ${message}`, ...args);
  }, [enableLogs]);

  // 🔧 MANEJAR ACTUALIZACIONES CON DEBOUNCE
  const handleUpdate = useCallback((payload: any, eventType: string) => {
    if (!isMountedRef.current) return;

    const now = Date.now();
    
    // Aplicar debounce
    if (now - lastUpdateRef.current < debounceMs) {
      return;
    }
    
    lastUpdateRef.current = now;

    try {
      switch (eventType) {
        case 'INSERT':
          if (payload.new) {
            memoizedCallbacks.onOrderCreated?.(payload.new);
          }
          break;

        case 'UPDATE':
          if (payload.new && payload.old) {
            memoizedCallbacks.onOrderUpdated?.(payload.new);
            
            // Detectar cambios de estado específicos
            if (payload.new.status !== payload.old.status) {
              memoizedCallbacks.onStatusChanged?.(
                payload.new.id, 
                payload.old.status, 
                payload.new.status
              );
            }
          }
          break;

        case 'DELETE':
          if (payload.old) {
            memoizedCallbacks.onOrderDeleted?.(payload.old.id);
          }
          break;
      }
    } catch (error) {
      log('error', 'Error procesando actualización real-time:', error);
    }
  }, [memoizedCallbacks, debounceMs, log]);

  // 🔧 CONFIGURAR SUSCRIPCIÓN GLOBAL (SINGLETON)
  const setupGlobalSubscription = useCallback(() => {
    // Evitar múltiples suscripciones simultáneas
    if (globalIsConnecting || globalSubscription) {
      return;
    }

    globalIsConnecting = true;
    log('info', 'Configurando suscripción real-time global...');

    try {
      // Limpiar suscripción anterior si existe
      if (globalSubscription) {
        globalSubscription.unsubscribe();
        globalSubscription = null;
      }

      globalSubscription = supabase
        .channel('orders-realtime-global')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            if (isMountedRef.current) {
              log('info', `Evento real-time recibido: ${payload.eventType}`, (payload.new as any)?.id);
              handleUpdate(payload, payload.eventType);
            }
          }
        )
        .subscribe((status, err) => {
          globalIsConnecting = false;
          
          if (status === 'SUBSCRIBED') {
            globalRetryCount = 0;
            log('info', 'Suscripción real-time establecida');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            log('warn', `Error en suscripción real-time: ${status}`, err);
            
            // Solo reintentar si no hemos alcanzado el máximo
            if (globalRetryCount < maxRetries) {
              const delay = Math.min(retryDelay * Math.pow(backoffMultiplier, globalRetryCount), 10000);
              globalRetryCount++;
              log('info', `Reintentando conexión en ${delay}ms (intento ${globalRetryCount}/${maxRetries})`);
              
              setTimeout(() => {
                if (isMountedRef.current) {
                  setupGlobalSubscription();
                }
              }, delay);
            } else {
              log('error', 'Máximo de reintentos alcanzado para real-time');
            }
          }
        });

    } catch (error) {
      globalIsConnecting = false;
      log('error', 'Error configurando suscripción:', error);
    }
  }, [handleUpdate, maxRetries, retryDelay, backoffMultiplier, log]);

  // 🔧 CONFIGURAR SUSCRIPCIÓN AL MONTAR
  useEffect(() => {
    isMountedRef.current = true;
    
    // Solo configurar si no hay suscripción global activa
    if (!globalSubscription) {
      setupGlobalSubscription();
    }

    // Cleanup al desmontar
    return () => {
      isMountedRef.current = false;
    };
  }, [setupGlobalSubscription]);

  // 🔧 FUNCIÓN PARA FORZAR RECONEXIÓN
  const forceReconnect = useCallback(() => {
    if (!isMountedRef.current) return;
    
    log('info', 'Forzando reconexión real-time...');
    globalRetryCount = 0;
    
    if (globalSubscription) {
      globalSubscription.unsubscribe();
      globalSubscription = null;
    }
    
    setupGlobalSubscription();
  }, [setupGlobalSubscription, log]);

  // 🔧 FUNCIÓN PARA VERIFICAR ESTADO DE CONEXIÓN
  const getConnectionStatus = useCallback(() => {
    if (!globalSubscription) {
      return 'disconnected';
    }

    const state = globalSubscription.state;
    switch (state) {
      case 'joined':
        return 'connected';
      case 'joining':
        return 'connecting';
      case 'left':
        return 'disconnected';
      case 'error':
        return 'error';
      default:
        return 'unknown';
    }
  }, []);

  return {
    isConnected: getConnectionStatus() === 'connected',
    connectionStatus: getConnectionStatus(),
    retryCount: globalRetryCount,
    forceReconnect
  };
}

/**
 * 🔧 Hook específico para órdenes con estados estandarizados
 */
export function useOrdersRealtime(callbacks: RealtimeCallbacks = {}) {
  const optimizedCallbacks = useMemo(() => ({
    ...callbacks,
    onStatusChanged: (orderId: string, oldStatus: string, newStatus: string) => {
      // Solo log si la transición es inválida
      if (!isValidStatusTransition(oldStatus, newStatus)) {
        console.warn('⚠️ Transición de estado inválida:', {
          orderId,
          oldStatus,
          newStatus
        });
      }
      
      callbacks.onStatusChanged?.(orderId, oldStatus, newStatus);
    }
  }), [callbacks]);

  return useOptimizedRealtime(optimizedCallbacks, {
    debounceMs: 100,
    maxRetries: 3,
    retryDelay: 500,
    enableLogs: false // Sistema deshabilitado - usando RealtimeService
  });
}

/**
 * 🔧 Validar transición de estados - MEJORADO
 */
function isValidStatusTransition(oldStatus: string, newStatus: string): boolean {
  // Si oldStatus es undefined, es una nueva orden - permitir cualquier estado inicial
  if (!oldStatus || oldStatus === 'undefined') {
    return true;
  }

  const validTransitions: Record<string, string[]> = {
    'standby': ['enviado', 'sent', 'standby'],
    'enviado': ['confirmed', 'pending_confirmation', 'standby', 'pendiente_de_pago'], // 🔧 CORRECCIÓN: Agregar transición a PENDIENTE_DE_PAGO
    'sent': ['confirmed', 'pending_confirmation', 'standby', 'pendiente_de_pago'], // 🔧 CORRECCIÓN: Agregar transición a PENDIENTE_DE_PAGO
    'confirmed': ['factura_recibida', 'pagado', 'enviado'],
    'pending_confirmation': ['confirmed', 'cancelled'],
    'pendiente_de_pago': ['pagado', 'enviado'], // 🔧 CORRECCIÓN: Agregar estado PENDIENTE_DE_PAGO
    'factura_recibida': ['pagado', 'enviado'],
    'pagado': ['enviado', 'delivered', 'finalizado'],
    'delivered': ['finalizado'],
    'finalizado': ['finalizado'], // Estado final
    'cancelled': ['cancelled'] // Estado final
  };

  return validTransitions[oldStatus]?.includes(newStatus) || false;
}

/**
 * 🔧 Hook para notificaciones en tiempo real - SIMPLIFICADO
 */
export function useNotificationsRealtime() {
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    // Solo configurar si no hay suscripción activa
    if (subscriptionRef.current) {
      return;
    }

    subscriptionRef.current = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_orders'
        },
        (payload) => {
          // Log solo en desarrollo
          if (process.env.NODE_ENV === 'development') {
            console.log('🔔 Nueva orden pendiente:', payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);

  return {
    isSubscribed: subscriptionRef.current?.state === 'joined'
  };
}
