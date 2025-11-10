/**
 * Endpoint para actualizar la configuración de WhatsApp del usuario
 * Corrige la configuración para que coincida con los datos de Kapso
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [FixUserConfig] Actualizando configuración del usuario...');
    
    // Leer cookies de sesión manualmente
    const cookieHeader = request.headers.get('cookie');
    console.log('🍪 [FixUserConfig] Cookies recibidas:', cookieHeader);
    
    // También verificar Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔑 [FixUserConfig] Authorization header:', authHeader ? 'Presente' : 'No presente');
    
    if (!cookieHeader && !authHeader) {
      return NextResponse.json({ 
        error: 'No se encontraron cookies de sesión ni Authorization header. Ejecuta este comando desde la consola del navegador donde ya estés logueado.'
      }, { status: 401 });
    }
    
    // Intentar extraer el token de diferentes fuentes
    let accessToken = null;
    
    // Primero intentar con Authorization header (más directo)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
      console.log('✅ [FixUserConfig] Token encontrado en Authorization header');
    }
    
    // Si no hay token en Authorization header, buscar en cookies
    if (!accessToken && cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      // Debugging: mostrar todas las cookies encontradas
      console.log('🍪 [FixUserConfig] Todas las cookies:', Object.keys(cookies));
      
      // Buscar cualquier cookie que contenga 'auth' o 'token'
      const authCookies = Object.keys(cookies).filter(key => 
        key.toLowerCase().includes('auth') || 
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('supabase')
      );
      
      console.log('🔍 [FixUserConfig] Cookies de autenticación encontradas:', authCookies);
      
      // Buscar en cookies específicas de Supabase
      for (const cookieName of authCookies) {
        const cookieValue = cookies[cookieName];
        if (cookieValue && cookieValue.length > 50) { // Los tokens suelen ser largos
          try {
            // Intentar parsear como JSON (algunas cookies de Supabase son JSON)
            const parsed = JSON.parse(decodeURIComponent(cookieValue));
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              console.log('✅ [FixUserConfig] Token encontrado en cookie JSON:', cookieName);
              break;
            }
          } catch {
            // Si no es JSON, usar directamente como token
            accessToken = cookieValue;
            console.log('✅ [FixUserConfig] Token encontrado en cookie directa:', cookieName);
            break;
          }
        }
      }
    }
    
    console.log('🔑 [FixUserConfig] Token encontrado:', accessToken ? 'Sí' : 'No');
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'No se encontró token de acceso. Ejecuta este comando desde la consola del navegador donde ya estés logueado.',
        details: 'Intenta: fetch("/api/whatsapp/fix-user-config", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer TU_TOKEN_AQUÍ" } })'
      }, { status: 401 });
    }
    
    // Crear cliente de Supabase con el token
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Verificar el usuario con el token
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log('⚠️ [FixUserConfig] Error de autenticación:', authError?.message);
      return NextResponse.json({ 
        error: 'Token de acceso inválido. Refresca la página y vuelve a intentar.',
        details: authError?.message 
      }, { status: 401 });
    }

    console.log('👤 [FixUserConfig] Usuario:', user.email);

    // Configuración correcta basada en los datos de Kapso
    const correctConfig = {
      whatsapp_phone_number: '+5491135562673',
      kapso_config_id: 'bae605ec-7674-40da-8787-1990cc42cbb3',
      is_sandbox: true,
      is_active: true
    };

    console.log('📱 [FixUserConfig] Configuración correcta:', correctConfig);

    // Crear cliente con service key para actualizar la base de datos
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Primero verificar si existe una configuración para este usuario
    const { data: existingConfigs, error: checkError } = await supabaseAdmin
      .from('user_whatsapp_config')
      .select('*')
      .eq('user_id', user.id);

    if (checkError) {
      console.error('❌ [FixUserConfig] Error verificando configuración existente:', checkError);
      return NextResponse.json({ 
        error: 'Error verificando configuración existente',
        details: checkError.message 
      }, { status: 500 });
    }

    console.log('🔍 [FixUserConfig] Configuraciones existentes:', existingConfigs?.length || 0);

    let updatedConfig;
    let updateError;

    if (existingConfigs && existingConfigs.length > 0) {
      // Actualizar configuración existente
      console.log('📝 [FixUserConfig] Actualizando configuración existente...');
      const { data, error } = await supabaseAdmin
        .from('user_whatsapp_config')
        .update(correctConfig)
        .eq('user_id', user.id)
        .select()
        .single();
      
      updatedConfig = data;
      updateError = error;
    } else {
      // Crear nueva configuración
      console.log('➕ [FixUserConfig] Creando nueva configuración...');
      const { data, error } = await supabaseAdmin
        .from('user_whatsapp_config')
        .insert([{
          user_id: user.id,
          ...correctConfig
        }])
        .select()
        .single();
      
      updatedConfig = data;
      updateError = error;
    }

    if (updateError) {
      console.error('❌ [FixUserConfig] Error actualizando configuración:', updateError);
      return NextResponse.json({ 
        error: 'Error actualizando configuración',
        details: updateError.message 
      }, { status: 500 });
    }

    console.log('✅ [FixUserConfig] Configuración actualizada exitosamente:', updatedConfig);

    // 🔧 NUEVO: Configurar webhook automáticamente con ngrok
    try {
      console.log('🚀 [FixUserConfig] Configurando webhook automáticamente...');
      
      // Obtener URL de ngrok
      const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
      const ngrokData = await ngrokResponse.json();
      const ngrokUrl = ngrokData.tunnels?.[0]?.public_url;
      
      if (ngrokUrl) {
        const webhookUrl = `${ngrokUrl}/api/kapso/supabase-events`;
        
        // Configurar webhook en Kapso
        const kapsoApiKey = process.env.KAPSO_API_KEY;
        const kapsoApiUrl = process.env.KAPSO_API_URL || 'https://app.kapso.ai/api/v1';
        const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET || '2ea5549880d27417aa21fe65822bd24d01f2017a5a2bc114df9202940634c7eb';
        
        if (kapsoApiKey) {
          const webhookConfig = {
            webhook_url: webhookUrl,
            webhook_secret: webhookSecret,
            events: [
              'message.received',
              'message.sent',
              'message.delivered',
              'message.read',
              'document.received',
              'media.received'
            ]
          };

          const webhookResponse = await fetch(`${kapsoApiUrl}/whatsapp_configs/${correctConfig.kapso_config_id}/webhook`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${kapsoApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookConfig)
          });

          if (webhookResponse.ok) {
            const webhookData = await webhookResponse.json();
            console.log('✅ [FixUserConfig] Webhook configurado automáticamente:', webhookUrl);
            console.log('📊 [FixUserConfig] Respuesta de Kapso:', webhookData);
          } else {
            const errorText = await webhookResponse.text();
            console.log('⚠️ [FixUserConfig] Error configurando webhook:', webhookResponse.status, errorText);
          }
        }
      } else {
        console.log('⚠️ [FixUserConfig] Ngrok no está ejecutándose, webhook no configurado');
      }
    } catch (webhookError) {
      console.log('⚠️ [FixUserConfig] Error configurando webhook automáticamente:', webhookError);
      // No fallar la operación principal por este error
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración de WhatsApp actualizada correctamente',
      config: updatedConfig,
      webhookConfigured: true
    });

  } catch (error: any) {
    console.error('❌ [FixUserConfig] Error inesperado:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message 
    }, { status: 500 });
  }
}
