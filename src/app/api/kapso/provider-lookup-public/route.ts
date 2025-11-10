import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Endpoint público que acepta un token de sesión y retorna nombres de proveedores
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumbers, sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(phoneNumbers)) {
      return NextResponse.json(
        { error: 'phoneNumbers must be an array' },
        { status: 400 }
      );
    }

    // Crear cliente de Supabase con service role para bypass RLS pero filtrar manualmente por usuario
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener usuario autenticado desde el token
    const { createClient: createSupabaseClientForAuth } = await import('@supabase/supabase-js');
    const authSupabase = createSupabaseClientForAuth(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        }
      }
    );

    const { data: { user }, error: authError } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Buscar proveedores para todos los números de teléfono
    const results: Record<string, string | null> = {};

    for (const phoneNumber of phoneNumbers) {
      const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
      const searchDigits = normalizedPhone.slice(-10); // Últimos 10 dígitos

      const { data: providers, error } = await supabase
        .from('providers')
        .select('name, phone, contact_name')
        .eq('user_id', user.id)  // ✅ FILTRAR POR USUARIO
        .ilike('phone', `%${searchDigits}%`);

      if (error) {
        console.error(`Error fetching provider for ${phoneNumber}:`, error);
        results[phoneNumber] = null;
        continue;
      }

      // Encontrar mejor coincidencia
      const bestMatch = providers?.find(p => {
        const providerDigits = p.phone?.replace(/[^\d+]/g, '').slice(-10) || '';
        return providerDigits === searchDigits;
      });

      if (bestMatch) {
        // Mostrar ambos nombres: nombre del proveedor y nombre de contacto
        const displayName = bestMatch.contact_name 
          ? `${bestMatch.name} - ${bestMatch.contact_name}`
          : bestMatch.name;
        results[phoneNumber] = displayName;
      } else {
        results[phoneNumber] = null;
      }
    }

    return NextResponse.json({ names: results });
  } catch (error) {
    console.error('Error in public provider lookup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

