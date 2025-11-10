import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Bloqueado por política: no actualizar display name desde la app
    return NextResponse.json({ success: false, error: 'Display name updates are disabled' }, { status: 403 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Error desconocido' }, { status: 500 });
  }
}


