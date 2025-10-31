import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Obtener templates de mensajes de WhatsApp
 * GET /api/whatsapp/templates
 */
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`📋 [GetTemplates-${requestId}] Obteniendo templates`);
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [GetTemplates-${requestId}] Token de autenticación requerido`);
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log(`❌ [GetTemplates-${requestId}] Token de autenticación inválido`);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }
    
    console.log(`👤 [GetTemplates-${requestId}] Usuario autenticado: ${user.id}`);
    
    // Obtener templates desde Kapso API
    const kapsoApiKey = process.env.KAPSO_API_KEY;
    if (!kapsoApiKey) {
      console.log(`❌ [GetTemplates-${requestId}] KAPSO_API_KEY no configurada`);
      return NextResponse.json({ 
        error: 'API key de Kapso no configurada' 
      }, { status: 500 });
    }
    
    console.log(`📤 [GetTemplates-${requestId}] Consultando templates en Kapso`);
    
    const response = await fetch('https://app.kapso.ai/api/v1/whatsapp_templates', {
      headers: {
        'X-API-Key': kapsoApiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📤 [GetTemplates-${requestId}] Respuesta de Kapso: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log(`✅ [GetTemplates-${requestId}] Templates obtenidos:`, responseData);
      
      return NextResponse.json({
        success: true,
        templates: responseData.data || [],
        meta: responseData.meta || {}
      });
    } else {
      const errorData = await response.text();
      console.log(`❌ [GetTemplates-${requestId}] Error de Kapso:`, errorData);
      
      return NextResponse.json({
        success: false,
        error: `Error obteniendo templates: ${errorData}`,
        templates: []
      }, { status: response.status });
    }

  } catch (error: any) {
    console.error(`❌ [GetTemplates-${requestId}] Error inesperado:`, error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor',
      templates: []
    }, { status: 500 });
  }
}