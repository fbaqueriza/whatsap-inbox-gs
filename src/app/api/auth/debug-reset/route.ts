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

    console.log('🔍 [DebugReset] Generando link de reset para:', email);
    
    // Configurar URL de redirección
    const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/auth/reset-password`;
    
    console.log('🔍 [DebugReset] URL de redirección:', redirectUrl);
    
    // Usar admin API para generar link de reset
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl
      }
    });
    
    if (error) {
      console.error('❌ [DebugReset] Error generando link:', error);
      return NextResponse.json({ 
        error: 'Error generando link de reset',
        details: error.message 
      }, { status: 500 });
    }
    
    console.log('✅ [DebugReset] Link generado exitosamente');
    console.log('🔍 [DebugReset] Link de reset:', data.properties?.action_link);
    
    return NextResponse.json({ 
      success: true,
      message: 'Link de reset generado exitosamente',
      resetLink: data.properties?.action_link,
      redirectUrl: redirectUrl,
      email: email
    });
    
  } catch (error: any) {
    console.error('❌ [DebugReset] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error inesperado',
      details: error.message 
    }, { status: 500 });
  }
}
