import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticación del usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }
    
    // Normalizar usando la misma lógica del sistema
    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // Generar variantes de búsqueda
    const searchDigits = normalizedPhone.slice(-10); // Últimos 10 dígitos
    
    // Buscar proveedores SOLO DEL USUARIO ACTUAL (RLS aplicará automáticamente)
    const { data: providers, error } = await supabase
      .from('providers')
      .select('id, name, phone, contact_name')
      .ilike('phone', `%${searchDigits}%`);

    if (error) {
      console.error('Error fetching provider:', error);
      return NextResponse.json(
        { error: 'Failed to fetch provider' },
        { status: 500 }
      );
    }

    // Encontrar mejor coincidencia (comparando últimos dígitos)
    const bestMatch = providers?.find(p => {
      const providerDigits = p.phone?.replace(/[^\d+]/g, '').slice(-10) || '';
      return providerDigits === searchDigits;
    });

    if (bestMatch) {
      return NextResponse.json({
        name: bestMatch.contact_name || bestMatch.name,
        providerId: bestMatch.id
      });
    }

    // Si no hay coincidencia, devolver null
    return NextResponse.json({ name: null, providerId: null });
  } catch (error) {
    console.error('Error in provider lookup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

