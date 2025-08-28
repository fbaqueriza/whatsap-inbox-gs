import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Next.js está funcionando correctamente',
    timestamp: new Date().toISOString()
  });
}
