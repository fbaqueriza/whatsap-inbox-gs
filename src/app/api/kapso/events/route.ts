import { NextRequest } from 'next/server';

// Función para notificar eventos (ahora solo para logging)
export function notifyKapsoEvent(eventType: string, data: any) {
  console.log(`📡 [KapsoEvent] ${eventType}:`, data);
  // Ya no necesitamos notificar conexiones, Supabase Realtime se encarga
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response('User ID required', { status: 400 });
  }

  // Endpoint simplificado - solo para logging
  console.log(`📡 [KapsoEvent] Evento solicitado para usuario: ${userId}`);
  
  return new Response(JSON.stringify({ 
    message: 'Endpoint de eventos simplificado - usando Supabase Realtime',
    userId,
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
