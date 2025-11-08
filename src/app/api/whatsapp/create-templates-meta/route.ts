import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/whatsapp/create-templates-meta
 * Crear templates de WhatsApp usando Meta API directamente
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Autenticar usuario
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    // 2. Obtener body con access_token
    const body = await request.json();
    const { access_token, business_account_id } = body;

    if (!access_token) {
      return NextResponse.json({ 
        error: 'access_token es requerido',
        message: 'Necesitas proporcionar el access token de Meta para crear templates'
      }, { status: 400 });
    }

    // 3. Obtener configuración del usuario
    const { data: config, error: configError } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return NextResponse.json({ 
        error: 'Configuración de WhatsApp no encontrada',
        message: 'Asegúrate de tener una configuración de WhatsApp activa'
      }, { status: 404 });
    }

    const wabaId = business_account_id || config.waba_id || '1111665601092656';
    console.log('📱 Creando templates para Business Account:', wabaId);

    // 4. Templates a crear
    const templates = [
      {
        name: 'inicializador_de_conv',
        language: 'es',
        category: 'UTILITY',
        components: [
          {
            type: 'BODY',
            text: '👋 ¡Hola! Iniciando conversación para coordinar pedidos.\n\nEste es un mensaje automático para reiniciar nuestra conversación. A partir de ahora puedes enviarme mensajes libremente para coordinar pedidos y consultas.\n\n¡Gracias por tu colaboración!'
          }
        ]
      },
      {
        name: 'evio_orden',
        language: 'es',
        category: 'UTILITY',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: 'Nueva orden {{1}}'
          },
          {
            type: 'BODY',
            text: 'Buen día {{1}}! En cuanto me confirmes, paso el pedido de esta semana.'
          }
        ]
      }
    ];

    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
    const results = [];

    // 5. Crear cada template
    for (const template of templates) {
      try {
        console.log(`📝 Creando template: ${template.name}`);
        
        const url = `${WHATSAPP_API_URL}/${wabaId}/message_templates`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(template)
        });

        const responseText = await response.text();
        
        if (response.ok) {
          const responseData = JSON.parse(responseText);
          results.push({
            name: template.name,
            success: true,
            id: responseData.id,
            status: responseData.status || 'PENDING',
            message: 'Template creado exitosamente'
          });
          console.log(`✅ Template ${template.name} creado: ${responseData.id}`);
        } else {
          const errorData = JSON.parse(responseText);
          const errorMessage = errorData.error?.message || 'Error desconocido';
          const errorCode = errorData.error?.code || response.status;
          
          // Si el template ya existe, contar como éxito parcial
          const alreadyExists = errorMessage.includes('already exists') || 
                               errorMessage.includes('duplicate');
          
          results.push({
            name: template.name,
            success: alreadyExists,
            error: errorMessage,
            code: errorCode,
            message: alreadyExists ? 'Template ya existe' : 'Error creando template'
          });
          
          console.log(`${alreadyExists ? 'ℹ️' : '❌'} Template ${template.name}: ${errorMessage}`);
        }
      } catch (error: any) {
        results.push({
          name: template.name,
          success: false,
          error: error.message || 'Error inesperado',
          message: 'Error creando template'
        });
        console.error(`❌ Error creando template ${template.name}:`, error);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount} templates creados/existentes, ${failedCount} fallidos`,
      results: results,
      note: 'Los templates necesitan ser aprobados por Meta antes de poder usarse. Revisa el estado en Meta Business Manager.'
    });

  } catch (error: any) {
    console.error('❌ Error en create-templates-meta:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

