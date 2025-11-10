import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppConfigService } from '@/lib/whatsappConfigService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/whatsapp/update-kapso-config
 * Actualizar kapso_config_id en configuraciones existentes
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [UpdateKapsoConfig] Error de autenticación:', authError);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    console.log('📱 [UpdateKapsoConfig] Actualizando kapso_config_id para usuario:', user.id);

    // Obtener configuración activa del usuario
    const existingConfigResult = await WhatsAppConfigService.getActiveConfig(user.id);
    console.log('📱 [UpdateKapsoConfig] Resultado de getActiveConfig:', existingConfigResult);
    
    if (!existingConfigResult.success || !existingConfigResult.config) {
      console.error('❌ [UpdateKapsoConfig] No se encontró configuración activa');
      return NextResponse.json({ 
        error: 'No se encontró configuración activa de WhatsApp' 
      }, { status: 404 });
    }

    const config = existingConfigResult.config;

    // Si ya tiene kapso_config_id, no hacer nada
    if (config.kapso_config_id) {
      console.log('✅ [UpdateKapsoConfig] Configuración ya tiene kapso_config_id:', config.kapso_config_id);
      return NextResponse.json({
        success: true,
        config: config,
        message: 'Configuración ya tiene kapso_config_id'
      });
    }

    // Sin sandbox: retornar error explícito para crear/configurar número real
    return NextResponse.json({ 
      error: 'No hay configuración con kapso_config_id. Configura un número real primero.' 
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ [UpdateKapsoConfig] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
