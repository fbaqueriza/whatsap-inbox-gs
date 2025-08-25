"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";
import type { SupabaseClient } from '@supabase/supabase-js';

interface SupabaseAuthContextType {
  user: any;
  loading: boolean;
  needsEmailVerification: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearEmailVerification: () => void;
  clearEmailVerified: () => void;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    // Manejo de access_token en el hash de la URL tras confirmación de Supabase
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (!error) {
            setUser(data.session?.user ?? null);
            setLoading(false);
            window.location.hash = '';
            // Redirigir a la página de verificación exitosa
            window.location.replace('/auth/email-verified');
          }
        });
      }
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // Get initial user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Verificar si el error es por email no verificado
      if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
        setNeedsEmailVerification(true);
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) throw error;
    // Si el registro es exitoso, mostrar mensaje de verificación
    setNeedsEmailVerification(true);
  };

  const clearEmailVerification = () => {
    setNeedsEmailVerification(false);
  };

  const clearEmailVerified = () => {
    setEmailVerified(false);
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) throw error;
  };

  return (
    <SupabaseAuthContext.Provider value={{ 
      user, 
      loading, 
      needsEmailVerification, 
      emailVerified, 
      signIn, 
      signUp, 
      signOut, 
      resetPassword,
      clearEmailVerification, 
      clearEmailVerified 
    }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
} 