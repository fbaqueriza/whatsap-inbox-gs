import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [WhatsAppConfig] Verificando configuración de WhatsApp...');
    
    const config = {
      WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY ? '✅ Configurada' : '❌ Faltante',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? '✅ Configurada' : '❌ Faltante',
      WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ? '✅ Configurada' : '❌ Faltante',
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ? '✅ Configurada' : '❌ Faltante',
      WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET ? '✅ Configurada' : '❌ Faltante'
    };
    
    console.log('📊 [WhatsAppConfig] Configuración:', config);
    
    return NextResponse.json({
      success: true,
      config: config
    });
    
  } catch (error: any) {
    console.error('❌ [WhatsAppConfig] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
