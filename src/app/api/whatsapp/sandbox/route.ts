import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppConfigService } from '@/lib/whatsappConfigService';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/whatsapp/sandbox
 * Obtener información del número de sandbox disponible
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    console.log('📱 [WhatsAppSandbox] Obteniendo número de sandbox para usuario:', user.id);

    // Obtener número de sandbox de Kapso
    const kapsoService = new KapsoService();
    const sandboxInfo = await kapsoService.getSandboxNumber();
    
    if (!sandboxInfo) {
      return NextResponse.json({ 
        error: 'No hay número de sandbox disponible' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      sandbox: {
        id: sandboxInfo.config_id,
        name: 'Sandbox de Kapso',
        phone_number: sandboxInfo.phone_number,
        is_sandbox: true,
        status: 'active',
        config_id: sandboxInfo.config_id,
        is_available: true
      }
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppSandbox] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

/**
 * POST /api/whatsapp/sandbox
 * Configurar número de sandbox para el usuario autenticado
 */
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
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    console.log('📱 [WhatsAppSandbox] Configurando sandbox para usuario:', user.id);

    // Verificar si el usuario ya tiene una configuración activa
    const existingConfig = await WhatsAppConfigService.getActiveConfig(user.id);
    if (existingConfig.success && existingConfig.config) {
      return NextResponse.json({ 
        error: 'El usuario ya tiene una configuración de WhatsApp activa',
        existing_config: existingConfig.config
      }, { status: 400 });
    }

    // Obtener número de sandbox de Kapso
    const kapsoService = new KapsoService();
    const sandboxInfo = await kapsoService.getSandboxNumber();
    
    if (!sandboxInfo) {
      return NextResponse.json({ 
        error: 'No hay número de sandbox disponible' 
      }, { status: 404 });
    }

    // Crear configuración de sandbox
    const configData = {
      phone_number: sandboxInfo.phone_number,
      is_sandbox: true,
      webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/whatsapp/webhook`
    };

    const result = await WhatsAppConfigService.createConfig(user.id, configData);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Error creando configuración de sandbox' 
      }, { status: 500 });
    }

    // Actualizar con el ID de Kapso
    if (result.config) {
      await WhatsAppConfigService.updateConfig(result.config.id, {
        kapso_config_id: sandboxInfo.config_id
      }, user.id);
    }

    console.log('✅ [WhatsAppSandbox] Configuración de sandbox creada exitosamente');

    return NextResponse.json({
      success: true,
      config: result.config,
      message: 'Configuración de sandbox creada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppSandbox] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
