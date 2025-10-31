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

    console.log('🔍 [DebugEmail] Verificando configuración de email para:', email);
    
    // Verificar configuración de Supabase
    const config = {
      supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/auth/reset-password`
    };
    
    console.log('🔍 [DebugEmail] Configuración:', config);
    
    // Intentar enviar email de reset
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: config.redirectUrl
      }
    });
    
    console.log('🔍 [DebugEmail] Resultado de generateLink:', { data, error });
    
    if (error) {
      console.error('❌ [DebugEmail] Error generando link:', error);
      return NextResponse.json({ 
        error: 'Error generando link de reset',
        details: error.message,
        config 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Link de reset generado exitosamente',
      link: data.properties?.action_link,
      config 
    });
    
  } catch (error: any) {
    console.error('❌ [DebugEmail] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error inesperado',
      details: error.message 
    }, { status: 500 });
  }
}
