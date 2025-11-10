import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Email es requerido' 
      }, { status: 400 });
    }

    console.log('📧 [ResetPasswordEmail] Enviando email de reset para:', email);
    
    // Configurar URL de redirección
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/auth/reset-password`;
    
    console.log('📧 [ResetPasswordEmail] URL de redirección:', redirectUrl);
    
    // Usar admin API para generar link de reset
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });
    
    if (error) {
      console.error('❌ [ResetPasswordEmail] Error generando link:', error);
      return NextResponse.json({ 
        error: 'Error generando link de reset',
        details: error.message 
      }, { status: 500 });
    }
    
    console.log('✅ [ResetPasswordEmail] Link generado exitosamente');
    console.log('📧 [ResetPasswordEmail] Link de reset:', data.properties?.action_link);
    
    // En desarrollo, también logear el link para facilitar testing
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [DEV] Link de reset para testing:', data.properties?.action_link);
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Email de reset enviado exitosamente',
      // En desarrollo, incluir el link en la respuesta
      ...(process.env.NODE_ENV === 'development' && {
        resetLink: data.properties?.action_link
      })
    });
    
  } catch (error: any) {
    console.error('❌ [ResetPasswordEmail] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error inesperado',
      details: error.message 
    }, { status: 500 });
  }
}
