import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Crear una instancia singleton del cliente Supabase para servidor
let supabaseServerClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  if (!supabaseServerClient) {
    supabaseServerClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseServerClient;
}

// Exportar la instancia para uso directo
export const supabaseServer = getSupabaseServerClient();
