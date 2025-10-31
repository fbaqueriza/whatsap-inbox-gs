import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Intentar construir Authorization: Bearer <token> desde cookie sb-*-auth-token
  // Esto evita inconsistencias cuando el cliente está logueado pero el handler no lee bien el storage
  const authTokenCookie = cookieStore.getAll().find(c => /sb-.*-auth-token$/.test(c.name))?.value;
  const globalHeaders: Record<string, string> = {};
  if (authTokenCookie) {
    globalHeaders['Authorization'] = `Bearer ${authTokenCookie}`;
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: globalHeaders,
    },
    auth: {
      storage: {
        getItem: (key: string) => {
          return cookieStore.get(key)?.value ?? null;
        },
        setItem: (key: string, value: string) => {
          cookieStore.set(key, value);
        },
        removeItem: (key: string) => {
          cookieStore.delete(key);
        },
      },
    },
  });
}
