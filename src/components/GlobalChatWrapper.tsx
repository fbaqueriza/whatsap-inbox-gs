'use client';

import React, { useState, useEffect } from 'react';
import { useGlobalChat } from '../contexts/GlobalChatContext';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import IntegratedChatPanel from './IntegratedChatPanel';
import { supabase } from '../lib/supabase/client';
import { Provider } from '../types';

export default function GlobalChatWrapper() {
  const { isGlobalChatOpen, closeGlobalChat } = useGlobalChat();
  const { user } = useSupabaseAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar providers cuando se abra el chat
  useEffect(() => {
    if (isGlobalChatOpen && providers.length === 0) {
      setLoading(true);
      setError(null);
      
        // Si hay usuario autenticado, usar autenticación
        if (user) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.access_token) {
            setError('No hay sesión activa');
            setLoading(false);
            return;
          }

          fetch('/api/data/providers', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          })
            .then(r => r.json())
            .then(result => {
              if (result.providers && Array.isArray(result.providers)) {
                setProviders(result.providers || []);
              } else if (Array.isArray(result)) {
                setProviders(result || []);
              } else {
                console.error('❌ GlobalChatWrapper - Error en resultado:', result);
                setError(result.error || 'Error cargando proveedores');
              }
            })
            .catch(error => {
              console.error('Error cargando providers:', error);
              setError('Error de conexión');
            })
            .finally(() => {
              setLoading(false);
            });
        }).catch(error => {
          console.error('Error obteniendo sesión:', error);
          setError('Error de autenticación');
          setLoading(false);
        });
      } else {
        // Si no hay usuario, intentar cargar sin autenticación (para landing page)
        fetch('/api/data/providers')
          .then(r => r.json())
          .then(result => {
            if (result.providers && Array.isArray(result.providers)) {
              setProviders(result.providers || []);
            } else {
              console.error('❌ GlobalChatWrapper - Error sin auth:', result);
              setError('Error cargando proveedores');
            }
          })
          .catch(error => {
            console.error('Error cargando providers:', error);
            setError('Error de conexión');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [isGlobalChatOpen, user, providers.length]);

  // Limpiar providers cuando se cierre el chat
  useEffect(() => {
    if (!isGlobalChatOpen) {
      setProviders([]);
      setError(null);
    }
  }, [isGlobalChatOpen]);

  // 🔧 NUEVO: Escuchar evento para abrir chat con proveedor específico
  useEffect(() => {
    const handleOpenChatWithProvider = (event: CustomEvent) => {
      const { providerId, providerName, providerPhone, orderId, orderNumber } = event.detail;
      
      console.log('🔧 DEBUG - Evento recibido para abrir chat:', {
        providerId, providerName, providerPhone, orderId, orderNumber
      });
      
      // Abrir el chat global
      if (typeof window !== 'undefined') {
        // Importar dinámicamente el contexto para evitar problemas de SSR
        import('../contexts/GlobalChatContext').then(({ useGlobalChat }) => {
          // Aquí necesitaríamos acceso al contexto, pero como estamos en un componente
          // vamos a usar un enfoque diferente: abrir el chat y luego seleccionar el proveedor
          console.log('🔧 DEBUG - Abriendo chat global para proveedor:', providerName);
          
          // Disparar evento para abrir chat
          window.dispatchEvent(new CustomEvent('openGlobalChat'));
          
          // Después de un breve delay, seleccionar el proveedor
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('selectProviderInChat', {
              detail: { providerId, providerName, providerPhone }
            }));
          }, 100);
        });
      }
    };

    // Agregar listener para el evento personalizado
    window.addEventListener('openChatWithProvider', handleOpenChatWithProvider as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('openChatWithProvider', handleOpenChatWithProvider as EventListener);
    };
  }, []);

  return (
      <IntegratedChatPanel 
      providers={providers || []}
        isOpen={isGlobalChatOpen} 
        onClose={closeGlobalChat} 
      />
  );
}
