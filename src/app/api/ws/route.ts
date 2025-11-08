import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  if (request.headers.get('upgrade') === 'websocket') {
    return new Response('Servicio WebSocket no disponible en esta build', { status: 501 });
  }

  return new Response('Expected Upgrade: websocket', { status: 426 });
}