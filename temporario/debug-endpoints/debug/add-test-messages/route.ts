import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    console.log('🔍 [Debug] Agregando mensajes de prueba para usuario:', user.id);

    // Obtener configuración del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({ 
        error: 'No se encontró configuración de WhatsApp',
        details: configError?.message
      }, { status: 400 });
    }

    // Obtener proveedores
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .limit(3);

    if (providersError || !providers || providers.length === 0) {
      return NextResponse.json({ 
        error: 'No se encontraron proveedores',
        details: providersError?.message
      }, { status: 400 });
    }

    // Crear mensajes de prueba
    const testMessages = [];
    const now = new Date();
    
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const phoneNumber = provider.phone_number || provider.phone;
      
      if (!phoneNumber) continue;

      // Mensaje recibido del proveedor (hace 2 horas)
      testMessages.push({
        id: `test-received-${i}-${Date.now()}`,
        user_id: user.id,
        contact_id: phoneNumber,
        contact_name: provider.name,
        content: `Hola! Soy ${provider.name}. ¿Cómo estás?`,
        message_type: 'received',
        direction: 'inbound',
        status: 'delivered',
        timestamp: new Date(now.getTime() - (2 * 60 * 60 * 1000)), // 2 horas atrás
        whatsapp_config_id: userConfig.id
      });

      // Mensaje enviado por nosotros (hace 1 hora)
      testMessages.push({
        id: `test-sent-${i}-${Date.now()}`,
        user_id: user.id,
        contact_id: phoneNumber,
        contact_name: provider.name,
        content: `Hola ${provider.name}! Todo bien, gracias.`,
        message_type: 'sent',
        direction: 'outbound',
        status: 'delivered',
        timestamp: new Date(now.getTime() - (1 * 60 * 60 * 1000)), // 1 hora atrás
        whatsapp_config_id: userConfig.id
      });
    }

    // Insertar mensajes en la base de datos
    const { data: insertedMessages, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert(testMessages)
      .select();

    if (insertError) {
      console.error('❌ [Debug] Error insertando mensajes:', insertError);
      return NextResponse.json({ 
        error: 'Error insertando mensajes',
        details: insertError.message
      }, { status: 500 });
    }

    console.log('✅ [Debug] Mensajes de prueba agregados:', insertedMessages.length);

    return NextResponse.json({
      success: true,
      message: `Se agregaron ${insertedMessages.length} mensajes de prueba`,
      messages: insertedMessages
    });

  } catch (error: any) {
    console.error('❌ [Debug] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
