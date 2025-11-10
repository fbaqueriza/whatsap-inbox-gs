import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook de Kapso funcionando correctamente',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: 'GET'
  });
}

export async function POST(request: NextRequest) {
  const requestId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🧪 [${requestId}] ===== TEST WEBHOOK RECIBIDO =====`);
    
    // Log de headers
    console.log(`🔍 [${requestId}] Headers recibidos:`, {
      'x-kapso-signature': request.headers.get('x-kapso-signature'),
      'x-hub-signature-256': request.headers.get('x-hub-signature-256'),
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent')
    });
    
    const body = await request.json();
    console.log(`📥 [${requestId}] Body recibido:`, JSON.stringify(body, null, 2));
    
    return NextResponse.json({
      status: 'ok',
      message: 'Test webhook recibido correctamente',
      requestId,
      timestamp: new Date().toISOString(),
      headers: {
        'x-kapso-signature': request.headers.get('x-kapso-signature'),
        'x-hub-signature-256': request.headers.get('x-hub-signature-256'),
        'content-type': request.headers.get('content-type'),
        'user-agent': request.headers.get('user-agent')
      },
      body: body
    });
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error en test webhook:`, error);
    return NextResponse.json({
      status: 'error',
      message: 'Error en test webhook',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
