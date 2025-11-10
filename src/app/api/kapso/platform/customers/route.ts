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

    const { name, external_customer_id, metadata } = await request.json();

    if (!name || !external_customer_id) {
      return NextResponse.json({ 
        error: 'Nombre y external_customer_id son requeridos' 
      }, { status: 400 });
    }

    const platformService = new KapsoPlatformService();
    
    const result = await platformService.createCustomer({
      name,
      external_customer_id,
      metadata: {
        ...metadata,
        user_id: user.id,
        created_by: 'gastronomy-saas'
      }
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

    // Guardar referencia en Supabase
    const { error: dbError } = await supabase
      .from('whatsapp_configs')
      .insert({
        user_id: user.id,
        phone_number: 'pending',
        kapso_config_id: result.data.id,
        is_sandbox: false,
        is_active: false
      });

    if (dbError) {
      console.error('❌ [PlatformCustomers] Error guardando en Supabase:', dbError);
      // No fallar la operación, solo loggear
    }

    return NextResponse.json({
      success: true,
      customer: result.data,
      message: 'Cliente creado exitosamente en Kapso Platform'
    });

  } catch (error) {
    console.error('❌ [PlatformCustomers] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const platformService = new KapsoPlatformService();
    
    const result = await platformService.listCustomers();

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

    // Filtrar solo clientes del usuario actual
    const userCustomers = result.data.filter(customer => 
      customer.metadata?.user_id === user.id
    );

    return NextResponse.json({
      success: true,
      customers: userCustomers,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ [PlatformCustomers] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
