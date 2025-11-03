/**
 * API endpoint para configurar un número nuevo de WhatsApp en Kapso
 * Basado en la documentación oficial de Kapso
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getKapsoWebhookUrl } from '@/lib/envUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [KapsoSetup] Iniciando configuración de número nuevo');

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

    const { phoneNumber } = await request.json();
    
    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: 'Número de teléfono requerido' }, { status: 400 });
    }

    console.log('🔧 [KapsoSetup] Configurando número para usuario:', user.id);
    console.log('📱 [KapsoSetup] Número de WhatsApp:', phoneNumber);
    console.log('🌐 [KapsoSetup] URL base detectada:', getKapsoWebhookUrl());

    // Verificar si ya tiene configuración
    const { data: existingConfig } = await supabase
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingConfig) {
      console.log('⚠️ [KapsoSetup] Usuario ya tiene configuración:', existingConfig);
      return NextResponse.json({ 
        success: true, 
        message: 'Usuario ya tiene configuración de WhatsApp',
        config: existingConfig
      });
    }

    // 1. Crear configuración de WhatsApp en Kapso
    const whatsappConfig = await createWhatsAppConfig(phoneNumber);
    console.log('✅ [KapsoSetup] Configuración de WhatsApp creada:', whatsappConfig.id);

    // 1.1 Obtener detalles para capturar phone_number_id si no viene en la respuesta
    let phoneNumberId: string | undefined = whatsappConfig?.phone_number_id;
    if (!phoneNumberId) {
      try {
        const details = await getWhatsAppConfigDetails(whatsappConfig.id);
        phoneNumberId = details?.phone_number_id;
        console.log('📱 [KapsoSetup] phone_number_id obtenido:', phoneNumberId);
      } catch (e) {
        console.warn('⚠️ [KapsoSetup] No se pudo obtener phone_number_id en detalles:', e);
      }
    }

    // 2. Configurar webhook
    await setupWebhook(whatsappConfig.id);
    console.log('✅ [KapsoSetup] Webhook configurado');

    // 3. Guardar configuración en la base de datos (incluyendo phone_number_id)
    const { data: savedConfig, error: saveError } = await supabase
      .from('user_whatsapp_config')
      .insert({
        user_id: user.id,
        whatsapp_phone_number: phoneNumber,
        kapso_config_id: whatsappConfig.id,
        phone_number_id: phoneNumberId,
        is_active: true
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [KapsoSetup] Error guardando configuración:', saveError);
      throw new Error('Error guardando configuración en base de datos');
    }

    console.log('✅ [KapsoSetup] Configuración guardada en base de datos:', savedConfig);

    // ✅ NUEVO: Configurar templates automáticamente
    if (phoneNumberId) {
      try {
        console.log('🔧 [KapsoSetup] Configurando templates automáticamente...');
        const { whatsappTemplateSetupService } = await import('../../../../lib/whatsappTemplateSetupService');
        const templateResult = await whatsappTemplateSetupService.setupTemplatesForUser(user.id);
        
        if (templateResult.success) {
          console.log(`✅ [KapsoSetup] Templates configurados: ${templateResult.created} creados`);
        } else {
          console.warn('⚠️ [KapsoSetup] Templates no se pudieron configurar:', templateResult.error);
        }
      } catch (templateError) {
        console.error('❌ [KapsoSetup] Error configurando templates:', templateError);
        // No fallar el setup completo si los templates fallan
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Número de WhatsApp configurado exitosamente',
      config: savedConfig
    });

  } catch (error) {
    console.error('❌ [KapsoSetup] Error configurando número:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error configurando número' },
      { status: 500 }
    );
  }
}

async function createWhatsAppConfig(phoneNumber: string) {
  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KAPSO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      name: `WhatsApp Business - ${phoneNumber}`,
      webhook_url: getKapsoWebhookUrl(),
      webhook_secret: '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb',
      settings: {
        auto_reply: false,
        message_events: true,
        document_events: true,
        media_events: true,
        status_events: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [KapsoSetup] Error creando configuración:', errorText);
    throw new Error(`Error creando configuración en Kapso: ${response.statusText}`);
  }

  return await response.json();
}

async function getWhatsAppConfigDetails(whatsappConfigId: string) {
  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${whatsappConfigId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KAPSO_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [KapsoSetup] Error obteniendo detalles de configuración:', errorText);
    throw new Error(`Error obteniendo detalles en Kapso: ${response.statusText}`);
  }

  const details = await response.json();
  // Algunas respuestas vienen como { data: { ... } }
  return details?.data ?? details;
}

async function setupWebhook(whatsappConfigId: string) {
  const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${whatsappConfigId}/webhook`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${KAPSO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      webhook_url: getKapsoWebhookUrl(),
      webhook_secret: '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb',
      events: [
        'message.received',
        'message.sent',
        'message.delivered',
        'message.read',
        'document.received',
        'media.received'
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [KapsoSetup] Error configurando webhook:', errorText);
    throw new Error(`Error configurando webhook en Kapso: ${response.statusText}`);
  }

  return await response.json();
}
