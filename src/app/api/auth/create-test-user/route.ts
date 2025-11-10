import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [CreateTestUser] Creando usuario de prueba...');
    
    // Crear usuario de prueba
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test@gastronomy-saas.com',
      password: 'test123456',
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: {
        name: 'Usuario de Prueba'
      }
    });

    if (error) {
      console.error('❌ [CreateTestUser] Error creando usuario:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 400 });
    }

    console.log('✅ [CreateTestUser] Usuario de prueba creado:', data.user?.email);
    
    return NextResponse.json({
      success: true,
      message: 'Usuario de prueba creado exitosamente',
      credentials: {
        email: 'test@gastronomy-saas.com',
        password: 'test123456'
      },
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    });

  } catch (error) {
    console.error('❌ [CreateTestUser] Error inesperado:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
