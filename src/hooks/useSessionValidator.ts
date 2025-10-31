import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';

// Helper para detectar páginas protegidas
const isProtectedPage = (pathname: string): boolean => {
  const protectedPaths = ['/dashboard', '/orders', '/providers', '/stock', '/profile'];
  return protectedPaths.some(path => pathname.startsWith(path));
};

export function useSessionValidator() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Verificar la sesión cada 30 segundos
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔐 SessionValidator: Verificando sesión:', {
          hasSession: !!session,
          hasError: !!error,
          expiresAt: session?.expires_at,
          currentTime: Date.now() / 1000,
          isExpired: session ? session.expires_at < Date.now() / 1000 : true
        });
        
        if (error || !session || session.expires_at < Date.now() / 1000) {
          console.log('🔐 SessionValidator: Sesión inválida detectada');
          
          // Limpiar sesión
          await supabase.auth.signOut();
          
          // Redirigir al login si estamos en una página protegida
          if (typeof window !== 'undefined' && isProtectedPage(window.location.pathname)) {
            console.log('🔐 SessionValidator: Redirigiendo a login desde:', window.location.pathname);
            window.location.href = '/auth/login';
          }
        }
      } catch (error) {
        console.error('🔐 SessionValidator: Error verificando sesión:', error);
      }
    };

    // ❌ DESHABILITADO TEMPORALMENTE: No verificar sesión para evitar cierres automáticos
    // checkSession();

    // ❌ DESHABILITADO: No usar verificación periódica
    // intervalRef.current = setInterval(checkSession, 30000); // 30 segundos

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return null;
}
