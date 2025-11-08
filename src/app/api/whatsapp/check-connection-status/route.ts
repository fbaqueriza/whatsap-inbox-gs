import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verificar el estado de la conexión de WhatsApp del usuario
 * GET /api/whatsapp/check-connection-status
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔍 [ConnectionStatus-${requestId}] Verificando estado de conexión`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [ConnectionStatus-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [ConnectionStatus-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [ConnectionStatus-${requestId}] Usuario autenticado: ${user.id}`);
    
    // Obtener la configuración del usuario
    const { data: configData } = await supabase
      .from('whatsapp_configs')
      .select('kapso_config_id, webhook_url, is_active, phone_number')
      .eq('user_id', user.id)
      .single();
    
    if (!configData) {
      console.log(`❌ [ConnectionStatus-${requestId}] Usuario no tiene configuración`);
      return NextResponse.json({
        success: true,
        status: 'not_configured',
        message: 'Usuario no tiene configuración de WhatsApp'
      });
    }
    
    const config = configData;

    if (!config.kapso_config_id) {
      console.log(`❌ [ConnectionStatus-${requestId}] Usuario no tiene customer en Kapso`);
      return NextResponse.json({
        success: true,
        status: 'no_customer',
        message: 'Usuario no tiene customer en Kapso Platform',
      });
    }

    if (!config.is_active) {
      return NextResponse.json({
        success: true,
        status: 'pending_connection',
        setup_link: config.webhook_url,
        message: 'Configuración creada pero pendiente de conexión',
      });
    }

    return NextResponse.json({
      success: true,
      status: 'connected',
      whatsapp_config: {
        customer_id: config.kapso_config_id,
        phone_number: config.phone_number,
        setup_link: config.webhook_url,
      },
      message: 'WhatsApp conectado exitosamente',
    });

  } catch (error: any) {
    console.error(`❌ [ConnectionStatus-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
