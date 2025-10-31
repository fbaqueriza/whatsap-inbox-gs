'use client';

import { useEffect, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { usePathname } from 'next/navigation';

export default function ChatInitializer() {
  const { loadMessages } = useChat();
  const { user, isLoading } = useSupabaseAuth();
  const hasInitialized = useRef(false);
  const pathname = usePathname();
  
  // No inicializar en páginas de autenticación o configuración
  const isAuthPage = pathname?.includes('/auth/');
  const isConfigPage = pathname?.includes('/whatsapp-config');
  const shouldSkip = isAuthPage || isConfigPage;

  // ✅ HABILITADO: ChatInitializer para inicializar el chat del usuario autenticado
  useEffect(() => {
    console.log('🔧 [ChatInitializer] ChatInitializer habilitado para usuario autenticado');
    
    // Solo inicializar si no estamos en páginas de auth o configuración
    if (!shouldSkip) {
      console.log('🔧 [ChatInitializer] Inicializando chat...');
      // El ChatContext se encargará de la inicialización real
    }
  }, [shouldSkip]);

  // Este componente no renderiza nada, solo inicializa el contexto
  return null;
}
