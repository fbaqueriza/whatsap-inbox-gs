import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const appUrl = searchParams.get('appUrl');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido' },
        { status: 400 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { success: false, error: 'appUrl es requerido' },
        { status: 400 }
      );
    }

    const sanitizedAppUrl = appUrl.replace(/\/$/, '');
    const targetUrl = `${sanitizedAppUrl}/api/data/providers?user_id=${encodeURIComponent(
      userId
    )}`;

    const authHeader = request.headers.get('authorization') ?? undefined;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: authHeader ? { Authorization: authHeader } : undefined,
      cache: 'no-store',
    });

    const rawBody = await response.text();
    try {
      const json = JSON.parse(rawBody);
      return NextResponse.json(json, { status: response.status });
    } catch {
      return new NextResponse(rawBody, {
        status: response.status,
        headers: { 'content-type': 'text/plain' },
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Error inesperado obteniendo proveedores',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

