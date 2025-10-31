import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';

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
        console.log('🔍 [KapsoChatNoFilter] GET request - action: conversations, user:', user.email);
        
        try {
          // Usar KapsoService para obtener conversaciones de Kapso
          const kapsoService = new KapsoService();
          const conversationsResponse = await kapsoService.getAllActiveConversations();
          
          console.log('🔍 [KapsoChatNoFilter] Conversaciones de Kapso obtenidas:', conversationsResponse.length);

          // Obtener proveedores del usuario para filtrar
          const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, name, contact_name, phone')
            .eq('user_id', user.id);

          if (providersError) {
            console.error('❌ [KapsoChatNoFilter] Error obteniendo proveedores:', providersError);
            // Continuar sin filtro si hay error
          }

          console.log('🔍 [KapsoChatNoFilter] Proveedores encontrados:', providers?.length || 0);

          // NO FILTRAR - mostrar todas las conversaciones
          const allConversations = conversationsResponse;
          console.log('🔍 [KapsoChatNoFilter] Mostrando todas las conversaciones sin filtro:', allConversations.length);

          // Mapear conversaciones para usar nombres de proveedores
          const mappedConversations = allConversations.map(conv => {
            // Buscar el proveedor correspondiente
            const matchingProvider = providers?.find(provider => {
              const providerPhone = conv.phone_number?.replace(/[^\d+]/g, '');
              const providerPhoneNormalized = provider.phone?.replace(/[^\d+]/g, '');
              return providerPhoneNormalized && providerPhone?.includes(providerPhoneNormalized);
            });

            // Usar el nombre del proveedor si existe, sino el nombre de Kapso
            const displayName = matchingProvider?.name || matchingProvider?.contact_name || conv.contact_name || conv.phone_number;
            
            console.log('🔍 [KapsoChatNoFilter] Mapeando conversación:', {
              original_name: conv.contact_name,
              provider_name: matchingProvider?.name,
              display_name: displayName
            });

            return {
              ...conv,
              contact_name: displayName,
              name: displayName
            };
          });

          console.log('🔍 [KapsoChatNoFilter] Conversaciones mapeadas:', mappedConversations.length);

          return NextResponse.json({ 
            success: true, 
            data: mappedConversations 
          });

        } catch (kapsoError) {
          console.error('❌ [KapsoChatNoFilter] Error obteniendo conversaciones de Kapso:', kapsoError);
          return NextResponse.json({ 
            success: true, 
            data: [] 
          });
        }

      case 'messages':
        if (!phoneNumber) {
          return NextResponse.json({ error: 'Número de teléfono requerido' }, { status: 400 });
        }

        console.log('🔍 [KapsoChatNoFilter] GET request - action: messages, phoneNumber:', phoneNumber, 'user:', user.email);

        try {
          // Usar KapsoService para obtener mensajes de Kapso
          const kapsoService = new KapsoService();
          const messagesResponse = await kapsoService.getMessagesForPhone(phoneNumber);
          
          console.log('🔍 [KapsoChatNoFilter] Mensajes de Kapso obtenidos:', messagesResponse.messages.length);

          return NextResponse.json({ 
            success: true, 
            messages: messagesResponse.messages || [],
            hasMore: messagesResponse.hasMore,
            nextCursor: null
          });

        } catch (kapsoError) {
          console.error('❌ [KapsoChatNoFilter] Error obteniendo mensajes de Kapso:', kapsoError);
          return NextResponse.json({ 
            success: true, 
            messages: [],
            hasMore: false,
            nextCursor: null
          });
        }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error en API Kapso Chat No Filter:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
