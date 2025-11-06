/**
 * API endpoint para configurar automáticamente el sandbox de Kapso
 * Para testing del flujo de configuración
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const KAPSO_API_KEY = process.env.KAPSO_API_KEY?.trim();
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [KapsoSandbox] Configurando sandbox para testing');

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no autenticado' }, { status: 401 });
    }

    console.log('🧪 [KapsoSandbox] Configurando sandbox para usuario:', user.id);

    // 1. Obtener configuración de sandbox de Kapso
    const sandboxConfig = await getKapsoSandboxConfig();
    console.log('🧪 [KapsoSandbox] Configuración de sandbox obtenida:', sandboxConfig);

    // 2. Guardar configuración en la base de datos
    const { data: savedConfig, error: saveError } = await supabase
      .from('user_whatsapp_config')
      .upsert({
        user_id: user.id,
        whatsapp_phone_number: sandboxConfig.phone_number,
        kapso_config_id: sandboxConfig.id,
        phone_number_id: sandboxConfig.phone_number_id,
        is_active: true,
        is_sandbox: true
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [KapsoSandbox] Error guardando configuración:', saveError);
      throw new Error('Error guardando configuración en base de datos');
    }

    console.log('✅ [KapsoSandbox] Configuración de sandbox guardada:', savedConfig);

    return NextResponse.json({
      success: true,
      message: 'Sandbox configurado exitosamente para testing',
      config: savedConfig,
      sandboxInfo: {
        phoneNumber: sandboxConfig.phone_number,
        isSandbox: true,
        instructions: 'Este es un número de sandbox para testing. Los mensajes se simularán.'
      }
    });

  } catch (error) {
    console.error('❌ [KapsoSandbox] Error configurando sandbox:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error configurando sandbox' },
      { status: 500 }
    );
  }
}

async function getKapsoSandboxConfig() {
  // Buscar configuración de sandbox existente
  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs`, {
    method: 'GET',
    headers: {
      'X-API-Key': KAPSO_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo configuraciones: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Buscar configuración de sandbox (generalmente tiene un nombre específico o es la primera)
  const sandboxConfig = data.data?.find((config: any) => 
    config.name?.toLowerCase().includes('sandbox') || 
    config.phone_number?.includes('sandbox') ||
    config.is_sandbox === true
  ) || data.data?.[0]; // Si no encuentra sandbox, usar la primera

  if (!sandboxConfig) {
    throw new Error('No se encontró configuración de sandbox en Kapso');
  }

  return sandboxConfig;
}
