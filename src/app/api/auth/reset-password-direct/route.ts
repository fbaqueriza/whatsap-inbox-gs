import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json();
    
    if (!email || !newPassword) {
      return NextResponse.json({ 
        error: 'Email y nueva contraseña son requeridos' 
      }, { status: 400 });
    }

    console.log('🔐 [Reset Direct] Reseteando contraseña para:', email);
    
    // Primero, obtener el usuario por email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ [Reset Direct] Error obteniendo usuarios:', userError);
      return NextResponse.json({ 
        error: 'Error obteniendo usuarios',
        details: userError.message 
      }, { status: 500 });
    }

    // Buscar el usuario por email
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ [Reset Direct] Usuario no encontrado:', email);
      return NextResponse.json({ 
        error: 'Usuario no encontrado' 
      }, { status: 404 });
    }

    console.log('✅ [Reset Direct] Usuario encontrado:', user.id);

    // Actualizar la contraseña directamente
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (error) {
      console.error('❌ [Reset Direct] Error actualizando contraseña:', error);
      return NextResponse.json({ 
        error: 'Error actualizando contraseña',
        details: error.message 
      }, { status: 500 });
    }

    console.log('✅ [Reset Direct] Contraseña actualizada exitosamente');
    
    return NextResponse.json({ 
      success: true,
      message: 'Contraseña actualizada exitosamente',
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ [Reset Direct] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}