'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';

interface WhatsAppConfig {
  id: string;
  user_id: string;
  whatsapp_phone_number: string;
  kapso_config_id: string;
  is_active: boolean;
  is_sandbox?: boolean;
  created_at: string;
  updated_at: string;
}

interface UseWhatsAppConfigReturn {
  config: WhatsAppConfig | null;
  loading: boolean;
  error: string | null;
  hasConfig: boolean;
  isSandbox: boolean;
  setupSandbox: () => Promise<boolean>;
  setupRealNumber: (phoneNumber: string) => Promise<boolean>;
  refreshConfig: () => Promise<void>;
}

export function useWhatsAppConfig(): UseWhatsAppConfigReturn {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setConfig(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('user_whatsapp_config')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setConfig(data || null);
      console.log('🔍 [WhatsAppConfig] Configuración cargada:', data ? 'SÍ' : 'NO');

    } catch (err) {
      console.error('❌ [WhatsAppConfig] Error cargando configuración:', err);
      setError(err instanceof Error ? err.message : 'Error cargando configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  const setupSandbox = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No estás autenticado');
      }

      const response = await fetch('/api/kapso/setup-sandbox', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error configurando sandbox');
      }

      console.log('✅ [WhatsAppConfig] Sandbox configurado:', data.config);
      setConfig(data.config);
      return true;

    } catch (err) {
      console.error('❌ [WhatsAppConfig] Error configurando sandbox:', err);
      setError(err instanceof Error ? err.message : 'Error configurando sandbox');
      return false;
    }
  }, []);

  const setupRealNumber = useCallback(async (phoneNumber: string): Promise<boolean> => {
    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No estás autenticado');
      }

      const response = await fetch('/api/kapso/setup-number', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error configurando número');
      }

      console.log('✅ [WhatsAppConfig] Número configurado:', data.config);
      setConfig(data.config);
      return true;

    } catch (err) {
      console.error('❌ [WhatsAppConfig] Error configurando número:', err);
      setError(err instanceof Error ? err.message : 'Error configurando número');
      return false;
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    hasConfig: !!config,
    isSandbox: config?.is_sandbox || false,
    setupSandbox,
    setupRealNumber,
    refreshConfig
  };
}
