/**
 * 🔧 FACTORY CENTRALIZADO PARA CLIENTES SUPABASE
 * 
 * Este servicio centraliza la creación de clientes Supabase para evitar duplicaciones
 * y asegurar configuración consistente en toda la aplicación.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuración centralizada
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cache de clientes para evitar recreaciones innecesarias
const clientCache = new Map<string, SupabaseClient>();

export class SupabaseClientFactory {
  /**
   * 🔧 Obtiene cliente Supabase con clave anónima (para frontend)
   */
  static getAnonClient(): SupabaseClient {
    const cacheKey = 'anon';
    
    if (clientCache.has(cacheKey)) {
      return clientCache.get(cacheKey)!;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Variables de entorno de Supabase faltantes: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000)
      },
      db: {
        schema: 'public'
      }
    });

    clientCache.set(cacheKey, client);
    return client;
  }

  /**
   * 🔧 Obtiene cliente Supabase con service role key (para backend)
   */
  static getServiceClient(): SupabaseClient {
    const cacheKey = 'service';
    
    if (clientCache.has(cacheKey)) {
      return clientCache.get(cacheKey)!;
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variables de entorno de Supabase faltantes: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }

    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        heartbeatIntervalMs: 30000,
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000)
      },
      db: {
        schema: 'public'
      }
    });

    clientCache.set(cacheKey, client);
    return client;
  }

  /**
   * 🔧 Obtiene cliente Supabase basado en el contexto (servidor o cliente)
   */
  static getClient(): SupabaseClient {
    const isServer = typeof window === 'undefined';
    return isServer ? this.getServiceClient() : this.getAnonClient();
  }

  /**
   * 🔧 Limpia el cache de clientes (útil para testing)
   */
  static clearCache(): void {
    clientCache.clear();
  }

  /**
   * 🔧 Valida que las variables de entorno estén configuradas
   */
  static validateConfig(): { isValid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    
    return {
      isValid: missing.length === 0,
      missing
    };
  }
}

// Exportaciones de conveniencia
export const getSupabaseClient = SupabaseClientFactory.getClient;
export const getSupabaseAnonClient = SupabaseClientFactory.getAnonClient;
export const getSupabaseServiceClient = SupabaseClientFactory.getServiceClient;
