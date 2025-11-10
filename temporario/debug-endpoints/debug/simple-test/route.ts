import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [SimpleTest] Endpoint funcionando');
    return NextResponse.json({ 
      success: true, 
      message: 'Endpoint funcionando correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ [SimpleTest] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
