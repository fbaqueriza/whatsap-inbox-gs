import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoPlatformService } from '@/lib/kapsoPlatformService';

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
      .select('kapso_config_id, webhook_url, is_active')
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
    
    if (!configData.kapso_config_id) {
      console.log(`❌ [ConnectionStatus-${requestId}] Usuario no tiene customer en Kapso`);
      return NextResponse.json({
        success: true,
        status: 'no_customer',
        message: 'Usuario no tiene customer en Kapso Platform'
      });
    }
    
    // Verificar configuraciones de WhatsApp en Kapso
    const kapsoPlatform = new KapsoPlatformService();
    
    try {
      const whatsappConfigsResponse = await kapsoPlatform.getWhatsAppConfigs(configData.kapso_config_id);
      const whatsappConfigs = whatsappConfigsResponse.data;
      
      console.log(`📱 [ConnectionStatus-${requestId}] Configuraciones encontradas: ${whatsappConfigs.length}`);
      
      if (whatsappConfigs.length === 0) {
        // No hay configuraciones, el usuario necesita conectar
        return NextResponse.json({
          success: true,
          status: 'pending_connection',
          setup_link: configData.webhook_url, // Usar webhook_url donde almacenamos el setup link
          message: 'Usuario necesita conectar su WhatsApp usando el setup link'
        });
      }
      
      // Hay configuraciones, verificar si están activas
      const activeConfig = whatsappConfigs.find(config => config.status === 'active');
      
      if (activeConfig) {
        // Actualizar la configuración en Supabase
        await supabase
          .from('whatsapp_configs')
          .update({
            phone_number: activeConfig.phone_number,
            kapso_config_id: activeConfig.id,
            is_active: true
          })
          .eq('user_id', user.id);
        
        console.log(`✅ [ConnectionStatus-${requestId}] WhatsApp conectado: ${activeConfig.phone_number}`);
        
        return NextResponse.json({
          success: true,
          status: 'connected',
          whatsapp_config: {
            id: activeConfig.id,
            phone_number: activeConfig.phone_number,
            display_name: activeConfig.display_name,
            status: activeConfig.status
          },
          message: 'WhatsApp conectado exitosamente'
        });
      } else {
        // Hay configuraciones pero no están activas
        const pendingConfig = whatsappConfigs.find(config => config.status === 'pending');
        
        return NextResponse.json({
          success: true,
          status: 'pending_verification',
          whatsapp_config: pendingConfig ? {
            id: pendingConfig.id,
            phone_number: pendingConfig.phone_number,
            display_name: pendingConfig.display_name,
            status: pendingConfig.status
          } : null,
          message: 'WhatsApp configurado pero pendiente de verificación'
        });
      }
      
    } catch (kapsoError: any) {
      console.error(`❌ [ConnectionStatus-${requestId}] Error consultando Kapso:`, kapsoError);
      
      // Si hay error en Kapso pero tenemos setup link, devolver estado pendiente
      if (configData.webhook_url) {
        return NextResponse.json({
          success: true,
          status: 'pending_connection',
          setup_link: configData.webhook_url, // Usar webhook_url donde almacenamos el setup link
          message: 'Error consultando Kapso, pero setup link disponible'
        });
      }
      
      throw kapsoError;
    }

  } catch (error: any) {
    console.error(`❌ [ConnectionStatus-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
