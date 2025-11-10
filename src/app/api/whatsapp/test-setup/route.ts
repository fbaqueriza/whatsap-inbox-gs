import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppConfigService } from '@/lib/whatsappConfigService';
import { KapsoService } from '@/lib/kapsoService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/whatsapp/test-setup
 * Endpoint de prueba para configurar WhatsApp sin autenticación
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [TestSetup] Iniciando prueba de configuración...');

    // Obtener el primer usuario de la base de datos
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError || !users?.users?.length) {
      console.error('❌ [TestSetup] No se encontraron usuarios:', usersError);
      return NextResponse.json({ error: 'No se encontraron usuarios' }, { status: 500 });
    }

    const testUser = users.users[0];
    console.log('🧪 [TestSetup] Usuario de prueba:', testUser.email);

    // Crear instancias de servicios
    const whatsappConfigService = new WhatsAppConfigService();

    // Verificar si el usuario ya tiene una configuración
    const { data: existingConfig, error: configError } = await whatsappConfigService.getActiveConfigByUserId(testUser.id);
    
    if (existingConfig) {
      console.log('✅ [TestSetup] Usuario ya tiene configuración:', existingConfig.phone_number);
      return NextResponse.json({
        success: true,
        config: existingConfig,
        message: 'El usuario ya tiene una configuración de WhatsApp'
      });
    }

    // Obtener número de sandbox de Kapso
    const kapsoService = KapsoService.getInstance();
    const sandboxInfo = await kapsoService.getSandboxNumber();
    
    if (!sandboxInfo) {
      console.error('❌ [TestSetup] No hay número de sandbox disponible');
      return NextResponse.json({ 
        error: 'No hay número de sandbox disponible. Contacta al administrador.' 
      }, { status: 503 });
    }

    console.log('📱 [TestSetup] Número de sandbox encontrado:', sandboxInfo.phone_number);

    // Crear configuración de sandbox para el usuario
    const { data: newConfig, error: createError } = await whatsappConfigService.createConfig({
      user_id: testUser.id,
      phone_number: sandboxInfo.phone_number,
      kapso_config_id: sandboxInfo.config_id,
      is_sandbox: true,
      is_active: true,
      webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/whatsapp/webhook`
    });
    
    if (createError) {
      console.error('❌ [TestSetup] Error creando configuración:', createError);
      return NextResponse.json({ 
        error: 'Error creando configuración de WhatsApp',
        details: createError
      }, { status: 500 });
    }

    console.log('✅ [TestSetup] Configuración de WhatsApp creada exitosamente para usuario:', testUser.id);

    return NextResponse.json({
      success: true,
      config: newConfig,
      message: 'Configuración de WhatsApp creada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [TestSetup] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
