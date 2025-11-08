import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoService } from '@/lib/kapsoService';
import { normalizePhoneNumber } from '@/lib/phoneNormalization';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      error: 'Endpoint de diagnóstico deshabilitado en producción',
    }, { status: 503 });
  }

  try {
    console.log('🔍 [Debug System Status] Verificando estado completo del sistema...');

    // Usar el usuario que sabemos que existe
    const testUser = {
      id: '23cceda2-e52d-4ec4-b93c-277b5576e8af',
      email: 'baqufra@gmail.com'
    };

    // Obtener configuración de WhatsApp del usuario
    const { data: userConfig, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('is_active', true)
      .single();

    if (configError || !userConfig) {
      return NextResponse.json({ 
        error: 'No se encontró configuración de WhatsApp',
        details: configError?.message
      }, { status: 400 });
    }

    // Usar KapsoService para obtener conversaciones
    const kapsoService = new KapsoService();
    const conversationsResponse = await kapsoService.getConversations({
      status: 'active',
      page: 1
    });

    console.log('📞 [Debug System Status] Conversaciones obtenidas:', conversationsResponse.data.length);

    // Procesar conversaciones con normalización (como lo haría el frontend)
    const processedContacts: any[] = [];
    const contactIds = new Set<string>();

    for (const conv of conversationsResponse.data) {
      const phoneNumber = conv.phone_number;
      if (!phoneNumber) continue;

      // Normalizar el número como lo hace el frontend
      const normalizedPhone = normalizePhoneNumber(phoneNumber).normalized;
      
      // Verificar si ya existe este contacto normalizado
      if (contactIds.has(normalizedPhone)) {
        console.log('⚠️ [Debug System Status] Contacto duplicado detectado:', {
          original: phoneNumber,
          normalized: normalizedPhone
        });
        continue;
      }

      contactIds.add(normalizedPhone);

      // Obtener mensajes para este contacto
      const messagesResponse = await kapsoService.getMessagesForPhone(phoneNumber);
      
      // Simular el mapeo de mensajes como lo hace el frontend
      const mappedMessages = messagesResponse.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        contact_id: normalizedPhone, // Usar número normalizado como ID único
        contact_name: conv.contact_name || normalizedPhone,
        timestamp: new Date(msg.created_at),
        type: msg.message_type || 'text',
        direction: msg.direction,
        status: msg.status || 'delivered'
      }));

      processedContacts.push({
        originalPhone: phoneNumber,
        normalizedPhone: normalizedPhone,
        contactName: conv.contact_name || normalizedPhone,
        messageCount: mappedMessages.length,
        contactId: normalizedPhone,
        messages: mappedMessages
      });
    }

    console.log('📊 [Debug System Status] Contactos únicos después de procesamiento:', processedContacts.length);

    return NextResponse.json({
      success: true,
      message: `Sistema funcionando correctamente - ${processedContacts.length} contactos únicos`,
      timestamp: new Date().toISOString(),
      systemStatus: {
        backendWorking: true,
        normalizationWorking: true,
        kapsoApiWorking: true,
        uniqueContacts: processedContacts.length,
        totalConversations: conversationsResponse.data.length
      },
      contacts: processedContacts,
      userConfig: {
        kapso_config_id: userConfig.kapso_config_id,
        whatsapp_phone_number: userConfig.whatsapp_phone_number
      },
      recommendations: processedContacts.length === 1 ? [
        "✅ Sistema funcionando correctamente",
        "🔄 Hacer hard refresh del navegador (Ctrl+Shift+R)",
        "💡 El frontend debería mostrar solo 1 contacto"
      ] : [
        "⚠️ Aún hay múltiples contactos",
        "🔍 Revisar lógica de normalización",
        "🔄 Verificar caché del navegador"
      ]
    });

  } catch (error: any) {
    console.error('❌ [Debug System Status] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
