import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verificar estado de conexión de WhatsApp
 * GET /api/whatsapp/check-status
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔍 [CheckStatus-${requestId}] Verificando estado de conexión`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [CheckStatus-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [CheckStatus-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [CheckStatus-${requestId}] Usuario autenticado: ${user.id}`);
    
    // Obtener configuración de WhatsApp del usuario
    const { data: configData, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (configError || !configData || configData.length === 0) {
      console.log(`❌ [CheckStatus-${requestId}] Usuario no tiene configuración de WhatsApp`);
      return NextResponse.json({
        success: false,
        error: 'Usuario no tiene configuración de WhatsApp',
        status: 'not_configured'
      });
    }
    
    const config = configData[0];
    console.log(`📱 [CheckStatus-${requestId}] Configuración encontrada:`, config);
    
    // Verificar estado en Kapso si tenemos customer_id
    if (config.kapso_config_id) {
      try {
        const kapsoApiKey = process.env.KAPSO_API_KEY;
        if (kapsoApiKey) {
          console.log(`🔍 [CheckStatus-${requestId}] Consultando estado en Kapso para customer: ${config.kapso_config_id}`);
          
          // Intentar obtener información del customer desde Kapso
          const response = await fetch(`https://app.kapso.ai/api/v1/customers/${config.kapso_config_id}`, {
            headers: {
              'X-API-Key': kapsoApiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const customerData = await response.json();
            console.log(`✅ [CheckStatus-${requestId}] Estado de customer en Kapso:`, customerData);
            
            return NextResponse.json({
              success: true,
              status: 'connected',
              config: {
                customer_id: config.kapso_config_id,
                phone_number: config.phone_number,
                setup_link: config.webhook_url,
                created_at: config.created_at
              },
              kapso_data: customerData,
              message: 'WhatsApp conectado y funcionando'
            });
          } else {
            console.log(`⚠️ [CheckStatus-${requestId}] Error consultando Kapso: ${response.status}`);
          }
        }
      } catch (error: any) {
        console.log(`⚠️ [CheckStatus-${requestId}] Error consultando Kapso:`, error.message);
      }
    }
    
    // Si no podemos verificar en Kapso, devolver estado local
    return NextResponse.json({
      success: true,
      status: config.phone_number === 'pending' ? 'pending_setup' : 'configured',
      config: {
        customer_id: config.kapso_config_id,
        phone_number: config.phone_number,
        setup_link: config.webhook_url,
        created_at: config.created_at
      },
      message: config.phone_number === 'pending' 
        ? 'Configuración creada, pendiente de conexión' 
        : 'Configuración completada'
    });

  } catch (error: any) {
    console.error(`❌ [CheckStatus-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}