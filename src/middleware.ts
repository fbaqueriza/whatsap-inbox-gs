import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith('/api/debug')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Endpoint de depuración deshabilitado en producción',
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/debug/:path*'],
};
