"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  getSession: () => Promise<any>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

// Helper para detectar páginas protegidas
const isProtectedPage = (pathname: string): boolean => {
  const protectedPaths = ['/dashboard', '/orders', '/providers', '/stock', '/profile'];
  return protectedPaths.some(path => pathname.startsWith(path));
};

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    // 🔧 AUTENTICACIÓN SIMPLIFICADA: Solo usar onAuthStateChange para evitar múltiples llamadas
    const { data: { subscription: listener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Silenciar logs periódicos de autenticación
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(session.user ?? null);
      setLoading(false);
    });
    
    return () => {
      listener?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Verificar si el error es por email no verificado
      if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
        setNeedsEmailVerification(true);
      }
      return { data: null, error };
    }
    return { data, error: null };
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

  const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
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
      clearEmailVerified,
      getSession
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