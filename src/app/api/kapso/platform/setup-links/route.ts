import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { KapsoPlatformService } from '@/lib/kapsoPlatformService';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { customer_id, expires_in = 86400, metadata } = await request.json();

    if (!customer_id) {
      return NextResponse.json({ 
        error: 'customer_id es requerido' 
      }, { status: 400 });
    }

    // Verificar que el cliente pertenece al usuario
    const { data: customer, error: customerError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('kapso_config_id', customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ 
        error: 'Cliente no encontrado o no autorizado' 
      }, { status: 404 });
    }

    const platformService = new KapsoPlatformService();
    
    const result = await platformService.createSetupLink({
      customer_id,
      expires_in,
      metadata: {
        ...metadata,
        user_id: user.id,
        business_name: customer.business_name || 'Mi Negocio'
      }
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      setup_link: result.data,
      message: 'Link de configuración creado exitosamente'
    });

  } catch (error) {
    console.error('❌ [PlatformSetupLinks] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
