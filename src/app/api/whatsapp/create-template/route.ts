import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KapsoPlatformService } from '@/lib/kapsoPlatformService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Crear un template de mensaje de WhatsApp
 * POST /api/whatsapp/create-template
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`📝 [CreateTemplate-${requestId}] Iniciando creación de template`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [CreateTemplate-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [CreateTemplate-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [CreateTemplate-${requestId}] Usuario autenticado: ${user.id}`);
    
    const { template_name, template_text, category = 'UTILITY', language = 'es' } = await request.json();
    
    if (!template_name || !template_text) {
      console.log(`❌ [CreateTemplate-${requestId}] Faltan parámetros requeridos`);
      return NextResponse.json({ 
        error: 'template_name y template_text son requeridos' 
      }, { status: 400 });
    }
    
    // Obtener la configuración de WhatsApp del usuario
    const { data: configData, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('kapso_config_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (configError || !configData || configData.length === 0) {
      console.log(`❌ [CreateTemplate-${requestId}] Usuario no tiene configuración de WhatsApp`);
      return NextResponse.json({
        error: 'Usuario no tiene configuración de WhatsApp'
      }, { status: 400 });
    }
    
    const configId = configData[0].kapso_config_id;
    console.log(`📱 [CreateTemplate-${requestId}] Creando template para config: ${configId}`);
    
    // Crear template usando Kapso API directamente
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log(`❌ [CreateTemplate-${requestId}] KAPSO_API_KEY no configurada`);
      return NextResponse.json({ 
        error: 'API key de Kapso no configurada' 
      }, { status: 500 });
    }
    
    const templateData = {
      whatsapp_config_id: configId,
      name: template_name,
      language: language,
      category: category,
      components: [
        {
          type: 'BODY',
          text: template_text
        }
      ]
    };
    
    console.log(`📤 [CreateTemplate-${requestId}] Enviando template a Kapso:`, templateData);
    
    const response = await fetch('https://app.kapso.ai/api/v1/whatsapp_templates', {
      method: 'POST',
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    
    console.log(`📤 [CreateTemplate-${requestId}] Respuesta de Kapso: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log(`✅ [CreateTemplate-${requestId}] Template creado exitosamente:`, responseData);
      
      return NextResponse.json({
        success: true,
        template: responseData,
        message: 'Template creado exitosamente. Está pendiente de aprobación por WhatsApp.'
      });
    } else {
      const errorData = await response.text();
      console.log(`❌ [CreateTemplate-${requestId}] Error de Kapso:`, errorData);
      
      return NextResponse.json({
        success: false,
        error: `Error creando template: ${errorData}`,
        details: errorData
      }, { status: response.status });
    }

  } catch (error: any) {
    console.error(`❌ [CreateTemplate-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
