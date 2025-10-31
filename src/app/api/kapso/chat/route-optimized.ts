import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const phoneNumber = searchParams.get('phoneNumber');
    const cursor = searchParams.get('cursor');

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

    switch (action) {
      case 'conversations':
        // Obtener proveedores del usuario
        const { data: providers, error: providersError } = await supabase
          .from('providers')
          .select('id, name, contact_name, phone')
          .eq('user_id', user.id);

        if (providersError) {
          return NextResponse.json({ error: 'Error obteniendo proveedores' }, { status: 500 });
        }

        // Obtener configuración WhatsApp del usuario
        const { data: userWhatsAppConfig, error: configError } = await supabase
          .from('user_whatsapp_config')
          .select('kapso_config_id, phone_number')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        // Obtener conversaciones de Kapso
        const { data: kapsoConversations, error: kapsoError } = await supabase
          .from('whatsapp_messages')
          .select('contact_name, phone_number, last_message, last_message_at, unread_count')
          .eq('user_id', user.id)
          .order('last_message_at', { ascending: false })
          .limit(50);

        if (kapsoError) {
          return NextResponse.json({ error: 'Error obteniendo conversaciones' }, { status: 500 });
        }

        // Filtrar conversaciones por proveedores del usuario
        const filteredConversations = kapsoConversations?.filter(conv => {
          const providerPhone = conv.phone_number?.replace(/[^\d+]/g, '');
          
          // Si hay proveedores, filtrar por ellos
          if (providers && providers.length > 0) {
            const hasMatchingProvider = providers.some(provider => {
              const providerPhoneNormalized = provider.phone?.replace(/[^\d+]/g, '');
              return providerPhoneNormalized && providerPhone?.includes(providerPhoneNormalized);
            });
            
            return hasMatchingProvider;
          }
          
          // Si no hay proveedores, mostrar todas las conversaciones
          return true;
        }) || [];

        return NextResponse.json({ 
          success: true, 
          data: filteredConversations 
        });

      case 'messages':
        if (!phoneNumber) {
          return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 });
        }

        // Obtener mensajes de Kapso
        const { data: kapsoMessages, error: messagesError } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('phone_number', phoneNumber)
          .order('timestamp', { ascending: false })
          .limit(100);

        if (messagesError) {
          return NextResponse.json({ error: 'Error obteniendo mensajes' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          messages: kapsoMessages || [],
          hasMore: false,
          nextCursor: null
        });

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error en API Kapso Chat:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
