import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Crear cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Registrar usuario
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/email-verified`
      }
    });

    if (error) {
      console.error('Error registrando usuario:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (data.user) {
      console.log('✅ Usuario registrado exitosamente:', data.user.email);
      
      // Crear registro en la tabla users si no existe
      try {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email,
            created_at: new Date().toISOString()
          });

        if (insertError && !insertError.message.includes('duplicate key')) {
          console.error('Error creando usuario en tabla users:', insertError);
          // No fallar el registro si hay error en la tabla users
        }
      } catch (err) {
        console.error('Error insertando en tabla users:', err);
        // No fallar el registro si hay error en la tabla users
      }


      return NextResponse.json({
        success: true,
        message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
        user: {
          id: data.user.id,
          email: data.user.email
        }
      });
    }

    return NextResponse.json(
      { error: 'Error desconocido durante el registro' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error en API de registro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
