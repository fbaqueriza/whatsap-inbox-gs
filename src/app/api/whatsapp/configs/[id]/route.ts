import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WhatsAppConfigService } from '@/lib/whatsappConfigService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * PATCH /api/whatsapp/configs/[id]
 * Actualizar una configuración de WhatsApp
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [WhatsAppConfigUpdate] Error de autenticación:', authError);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    const configId = params.id;
    const body = await request.json();

    console.log('📱 [WhatsAppConfigUpdate] Actualizando configuración:', configId);

    // Actualizar la configuración
    const updateResult = await WhatsAppConfigService.updateConfig(configId, body, user.id);
    
    if (!updateResult.success) {
      console.error('❌ [WhatsAppConfigUpdate] Error actualizando configuración:', updateResult.error);
      return NextResponse.json({ 
        error: updateResult.error || 'Error actualizando configuración' 
      }, { status: 400 });
    }

    console.log('✅ [WhatsAppConfigUpdate] Configuración actualizada exitosamente');

    return NextResponse.json({
      success: true,
      config: updateResult.config,
      message: 'Configuración actualizada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppConfigUpdate] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/whatsapp/configs/[id]
 * Eliminar una configuración de WhatsApp
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Obtener token de autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autenticación requerido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [WhatsAppConfigDelete] Error de autenticación:', authError);
      return NextResponse.json({ error: 'Token de autenticación inválido' }, { status: 401 });
    }

    const configId = params.id;

    console.log('📱 [WhatsAppConfigDelete] Eliminando configuración:', configId);

    // Eliminar la configuración
    const deleteResult = await WhatsAppConfigService.deleteConfig(configId, user.id);
    
    if (!deleteResult.success) {
      console.error('❌ [WhatsAppConfigDelete] Error eliminando configuración:', deleteResult.error);
      return NextResponse.json({ 
        error: deleteResult.error || 'Error eliminando configuración' 
      }, { status: 400 });
    }

    console.log('✅ [WhatsAppConfigDelete] Configuración eliminada exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Configuración eliminada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [WhatsAppConfigDelete] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
