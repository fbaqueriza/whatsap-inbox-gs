'use client';

import { useEffect, useState } from 'react';
import type { User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export { SupabaseAuthProvider } from './SupabaseAuthProvider';

export const useSupabaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Solo logear errores que no sean de sesión faltante
          if (error.message !== 'Auth session missing!') {
            console.error('🔐 SupabaseAuth: Error obteniendo sesión inicial:', error);
          }
          setUser(null);
        } else {
          setUser(session?.user ?? null);
        }
      } catch (error: any) {
        // Solo logear errores que no sean de sesión faltante
        if (error?.message !== 'Auth session missing!') {
          console.error('🔐 SupabaseAuth: Error inesperado obteniendo sesión:', error);
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        // Manejar verificación de email
        // if (event === 'SIGNED_UP' && session?.user && !session.user.email_confirmed_at) {
        //   setNeedsEmailVerification(true);
        // }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('🔐 SupabaseAuth: Error en signIn:', error);
        throw error;
      }
      
      return { data, error };
    } catch (error) {
      console.error('🔐 SupabaseAuth: Error en signIn:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        console.error('🔐 SupabaseAuth: Error en signUp:', error);
        throw error;
      }
      
      // Si el registro es exitoso pero requiere verificación
      if (data.user && !data.user.email_confirmed_at) {
        setNeedsEmailVerification(true);
      }
      
      return { data, error };
    } catch (error) {
      console.error('🔐 SupabaseAuth: Error en signUp:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('🔐 SupabaseAuth: Error en signOut:', error);
        throw error;
      }
      return { error };
    } catch (error) {
      console.error('🔐 SupabaseAuth: Error en signOut:', error);
      throw error;
    }
  };

  const getSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        if (error.message !== 'Auth session missing!') {
          console.error('🔐 SupabaseAuth: Error en getSession:', error);
        }
        return null;
      }

      return data.session ?? null;
    } catch (error: any) {
      if (error?.message !== 'Auth session missing!') {
        console.error('🔐 SupabaseAuth: Error inesperado en getSession:', error);
      }
      return null;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('🔐 [ResetPassword] Iniciando reset para email:', email);
      
      // Usar el endpoint personalizado que maneja mejor el email
      const response = await fetch('/api/auth/reset-password-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('🔐 [ResetPassword] Error del servidor:', result);
        throw new Error(result.error || 'Error enviando email de reset');
      }
      
      console.log('✅ [ResetPassword] Email de reset enviado exitosamente');
      
      // En desarrollo, mostrar el link en consola
      if (result.resetLink) {
        console.log('🔧 [DEV] Link de reset para testing:', result.resetLink);
      }
      
      return { data: result, error: null };
    } catch (error) {
      console.error('🔐 SupabaseAuth: Error en resetPassword:', error);
      throw error;
    }
  };

  const clearEmailVerification = () => {
    setNeedsEmailVerification(false);
  };

  return {
    user,
    isLoading,
    loading: isLoading,
    needsEmailVerification,
    signIn,
    signUp,
    signOut,
    resetPassword,
    getSession,
    clearEmailVerification,
  };
};
