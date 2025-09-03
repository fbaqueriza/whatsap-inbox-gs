import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno críticas
    const envVars = {
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ? '✅ Configurado' : '❌ No configurado',
      WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY ? '✅ Configurado' : '❌ No configurado',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? '✅ Configurado' : '❌ No configurado',
      WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ? '✅ Configurado' : '❌ No configurado',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurado' : '❌ No configurado',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ No configurado'
    };

    // Verificar configuración de Supabase
    let supabaseStatus = '❌ No configurado';
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        supabaseStatus = `❌ Error: ${error.message}`;
      } else {
        supabaseStatus = `✅ Conectado (${data || 0} mensajes)`;
      }
    } catch (error) {
      supabaseStatus = `❌ Error: ${error instanceof Error ? error.message : 'Desconocido'}`;
    }

    const status = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      webhook: {
        verifyToken: envVars.WHATSAPP_VERIFY_TOKEN,
        apiKey: envVars.WHATSAPP_API_KEY,
        phoneNumberId: envVars.WHATSAPP_PHONE_NUMBER_ID,
        businessAccountId: envVars.WHATSAPP_BUSINESS_ACCOUNT_ID
      },
      supabase: {
        url: envVars.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: envVars.SUPABASE_SERVICE_ROLE_KEY,
        connection: supabaseStatus
      },
      recommendations: []
    };

    // Generar recomendaciones
    if (envVars.WHATSAPP_VERIFY_TOKEN === '❌ No configurado') {
      status.recommendations.push('Configurar WHATSAPP_VERIFY_TOKEN en variables de entorno');
    }
    if (envVars.WHATSAPP_API_KEY === '❌ No configurado') {
      status.recommendations.push('Configurar WHATSAPP_API_KEY en variables de entorno');
    }
    if (envVars.WHATSAPP_PHONE_NUMBER_ID === '❌ No configurado') {
      status.recommendations.push('Configurar WHATSAPP_PHONE_NUMBER_ID en variables de entorno');
    }
    if (supabaseStatus.includes('❌')) {
      status.recommendations.push('Verificar conexión a Supabase');
    }

    return NextResponse.json(status);
    
  } catch (error) {
    console.error('❌ Error en diagnóstico del webhook:', error);
    
    return NextResponse.json({ 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
