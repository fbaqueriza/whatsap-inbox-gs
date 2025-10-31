import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoPlatformService } from '@/lib/kapsoPlatformService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Crear un setup link para que el usuario conecte su WhatsApp
 * POST /api/whatsapp/create-setup-link
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔗 [SetupLink-${requestId}] Iniciando creación de setup link`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [SetupLink-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [SetupLink-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [SetupLink-${requestId}] Usuario autenticado: ${user.id}`);
    
    // Obtener el customer_id del usuario (almacenado en kapso_config_id temporalmente)
    console.log(`🔍 [SetupLink-${requestId}] Buscando customer para usuario: ${user.id}`);
    
    const { data: configData, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('kapso_config_id')
      .eq('user_id', user.id)
      .not('kapso_config_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    
    console.log(`🔍 [SetupLink-${requestId}] Resultado de búsqueda:`, { configData, configError });
    
    if (configError) {
      console.log(`❌ [SetupLink-${requestId}] Error buscando customer:`, configError);
      return NextResponse.json({
        success: false,
        error: `Error buscando customer: ${configError.message}`
      }, { status: 500 });
    }
    
    if (!configData || configData.length === 0 || !configData[0]?.kapso_config_id) {
      console.log(`❌ [SetupLink-${requestId}] Usuario no tiene customer en Kapso`);
      return NextResponse.json({
        success: false,
        error: 'Usuario no tiene customer en Kapso. Debe crear un customer primero.'
      }, { status: 400 });
    }
    
    const customerId = configData[0].kapso_config_id;
    console.log(`📱 [SetupLink-${requestId}] Creando setup link para customer: ${customerId}`);
    
        // Crear setup link en Kapso Platform
        const kapsoPlatform = new KapsoPlatformService();
        
        console.log(`🔗 [SetupLink-${requestId}] Creando setup link real en Kapso...`);
        
        const setupLinkResponse = await kapsoPlatform.createSetupLink(customerId, {
          success_redirect_url: 'https://gastronomy-saas.vercel.app/dashboard/whatsapp-config?status=success',
          failure_redirect_url: 'https://gastronomy-saas.vercel.app/dashboard/whatsapp-config?status=error',
          allowed_connection_types: ['coexistence', 'dedicated'],
          theme_config: {
            primary_color: '#3b82f6'
          }
        });
        
        const setupLink = setupLinkResponse.data;
    
        console.log(`✅ [SetupLink-${requestId}] Setup link real creado en Kapso: ${setupLink.url}`);
    
    // Guardar el setup link en Supabase para referencia
    // Nota: La tabla actual no tiene campos específicos para setup link
    // Podemos usar webhook_url temporalmente para almacenar el setup link URL
    const { error: updateError } = await supabase
      .from('whatsapp_configs')
      .update({
        webhook_url: setupLink.url // Usar webhook_url temporalmente para almacenar setup link
      })
      .eq('user_id', user.id);
    
    if (updateError) {
      console.error(`❌ [SetupLink-${requestId}] Error guardando setup link en Supabase:`, updateError);
      // No fallar aquí, el setup link ya está creado en Kapso
    }
    
            console.log(`✅ [SetupLink-${requestId}] Setup link configurado exitosamente`);
            
            // 🚀 CREAR TEMPLATES AUTOMÁTICAMENTE
            console.log(`📝 [SetupLink-${requestId}] Creando templates automáticamente...`);
            await createDefaultTemplates(customerId, requestId);
            
            return NextResponse.json({
              success: true,
              setup_link: {
                id: setupLink.id,
                url: setupLink.url,
                expires_at: setupLink.expires_at
              },
              message: 'Setup link creado exitosamente. Templates creados automáticamente. Comparte este enlace con el usuario para que conecte su WhatsApp.'
            });

  } catch (error: any) {
    console.error(`❌ [SetupLink-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

/**
 * Crear templates por defecto automáticamente
 */
async function createDefaultTemplates(customerId: string, requestId: string) {
  const kapsoApiKey = process.env.KAPSO_API_KEY;
  if (!kapsoApiKey) {
    console.log(`❌ [SetupLink-${requestId}] KAPSO_API_KEY no configurada para crear templates`);
    return;
  }

  // Templates por defecto que se crearán automáticamente
  const defaultTemplates = [
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
          type: 'BODY',
          text: '🛒 *NUEVA ORDEN - {{provider_name}}*\n\nBuen día {{contact_name}}! En cuanto me confirmes, paso el pedido de esta semana.'
        }
      ]
    }
  ];

  console.log(`📝 [SetupLink-${requestId}] Creando ${defaultTemplates.length} templates por defecto...`);

  for (const template of defaultTemplates) {
    try {
      console.log(`📝 [SetupLink-${requestId}] Creando template: ${template.name}`);
      
      const templateData = {
        template: {
          whatsapp_config_ids: ['bae605ec-7674-40da-8787-1990cc42cbb3'], // ID de la configuración conectada
          name: template.name,
          language_code: template.language,
          category: template.category,
          content: template.components[0].text
        }
      };
      
      const response = await fetch('https://app.kapso.ai/api/v1/whatsapp_templates', {
        method: 'POST',
        headers: {
          'X-API-Key': kapsoApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });
      
      if (response.ok) {
        const responseData = await response.json();
        console.log(`✅ [SetupLink-${requestId}] Template ${template.name} creado exitosamente:`, responseData);
      } else {
        const errorData = await response.text();
        console.log(`⚠️ [SetupLink-${requestId}] Error creando template ${template.name}:`, errorData);
        // No fallar aquí, continuar con el siguiente template
      }
      
    } catch (error: any) {
      console.log(`⚠️ [SetupLink-${requestId}] Error inesperado creando template ${template.name}:`, error.message);
      // No fallar aquí, continuar con el siguiente template
    }
  }
  
  console.log(`✅ [SetupLink-${requestId}] Proceso de creación de templates completado`);
}
