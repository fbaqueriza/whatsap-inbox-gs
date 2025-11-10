import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { whatsappTemplateSetupService } from '@/lib/whatsappTemplateSetupService';

// Permitir GET también para facilitar el acceso desde el navegador
export async function GET(request: NextRequest) {
  return handleSetupTemplates(request);
}

export async function POST(request: NextRequest) {
  return handleSetupTemplates(request);
}

async function handleSetupTemplates(request: NextRequest) {
  try {
    console.log('🔧 [SetupTemplates] Iniciando configuración de templates');

    // Obtener usuario autenticado
    const supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: intentar extraer el token desde la cookie y validarlo explícitamente
    if (!user) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
      const accessToken = match?.[1];
      if (accessToken) {
        try {
          const res = await supabase.auth.getUser(accessToken);
          if (res.data.user) {
            user = res.data.user;
          }
        } catch (_) {
          // ignorar
        }
      }
    }

    // Permitir override en desarrollo: ?userId=... desde localhost
    const url = new URL(request.url);
    const overrideUserId = url.searchParams.get('userId');
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (!user && overrideUserId && isLocalhost) {
      console.warn('⚠️ [SetupTemplates] Override de usuario habilitado (solo dev):', overrideUserId);
      // Ejecutar con el userId provisto sin sesión
      const result = await whatsappTemplateSetupService.setupTemplatesForUser(overrideUserId);
      if (result.success) {
        console.log(`✅ [SetupTemplates] Templates configurados (override): ${result.created} creados`);
        return NextResponse.json({ success: true, created: result.created });
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
    }

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      }, { status: 401 });
    }

    console.log('👤 [SetupTemplates] Usuario:', user.id);

    // Configurar templates para el usuario
    const result = await whatsappTemplateSetupService.setupTemplatesForUser(user.id);

    if (result.success) {
      console.log(`✅ [SetupTemplates] Templates configurados: ${result.created} creados`);
      return NextResponse.json({
        success: true,
        message: `Templates configurados exitosamente: ${result.created} creados`,
        created: result.created
      });
    } else {
      console.error(`❌ [SetupTemplates] Error: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [SetupTemplates] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
