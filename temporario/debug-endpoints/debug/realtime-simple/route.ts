import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [RealtimeSimple] Probando sistema básico...');

    return NextResponse.json({
      success: true,
      message: 'Sistema básico funcionando',
      data: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        webhookUrl: 'https://gastronomy-saas.vercel.app/api/kapso/supabase-events',
        localUrl: 'http://localhost:3001/api/kapso/supabase-events',
        issue: 'Webhook configurado para producción, no para desarrollo local'
      }
    });

  } catch (error: any) {
    console.error('❌ [RealtimeSimple] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
