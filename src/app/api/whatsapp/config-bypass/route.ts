import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [Config Bypass] Obteniendo configuración WhatsApp...');

    // 1. Autenticar usuario
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
        console.log('🔍 [Config Bypass] Usuario autenticado:', userId);
      } catch (error) {
        console.error('❌ [Config Bypass] Error obteniendo usuario:', error);
      }
    }

    if (!userId) {
      console.error('❌ [Config Bypass] Usuario no autenticado');
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    // 2. Usar SERVICE ROLE para bypass RLS
    const { data: config, error } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ [Config Bypass] Error obteniendo configuración:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 3. Si no hay configuración, devolver 404 (sin sandbox) 
    if (!config) {
      console.log('⚠️ [Config Bypass] Usuario sin configuración activa');
      return NextResponse.json({ success: false, error: 'Sin configuración activa' }, { status: 404 });
    }

    console.log('✅ [Config Bypass] Configuración encontrada:', config);
    
    // 4. Para el phone_number_id, usamos kapso_config_id temporalmente
    // El inbox local tiene un fallback a PHONE_NUMBER_ID si este no está disponible
    // TODO: En el futuro, obtener phone_number_id real de Kapso API si es necesario
    const phoneNumberId = (config as any).phone_number_id || config.kapso_config_id || undefined;
    
    // 5. Devolver configuración con phone_number_id incluido
    return NextResponse.json({ 
      success: true, 
      data: {
        ...config,
        phone_number_id: phoneNumberId
      }
    });

  } catch (error) {
    console.error('❌ [Config Bypass] Error en bypass:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
