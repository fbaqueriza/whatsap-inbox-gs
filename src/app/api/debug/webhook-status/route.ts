import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [WebhookStatus] Verificando estado del webhook...');

    // Información del webhook
    const webhookInfo = {
      webhookUrl: 'https://gastronomy-saas.vercel.app/api/kapso/supabase-events',
      localUrl: 'http://localhost:3001/api/kapso/supabase-events',
      environment: process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      timestamp: new Date().toISOString()
    };

    console.log('📊 [WebhookStatus] Estado del webhook:', webhookInfo);

    return NextResponse.json({
      success: true,
      message: 'Estado del webhook verificado',
      data: webhookInfo
    });

  } catch (error: any) {
    console.error('❌ [WebhookStatus] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
