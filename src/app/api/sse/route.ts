import { NextRequest } from 'next/server';

// Store para mantener conexiones SSE activas
const connections = new Set<ReadableStreamDefaultController>();

export async function GET(request: NextRequest) {
  // Crear stream SSE
  const stream = new ReadableStream({
    start(controller) {
      // Agregar conexión al store
      connections.add(controller);
      console.log('🔌 [SSE] Nueva conexión establecida');
      
      // Enviar mensaje de conexión inicial
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected', message: 'Conectado al servidor' })}\n\n`);
    },
    cancel() {
      // Remover conexión del store
      connections.delete(controller);
      console.log('🔌 [SSE] Conexión cerrada');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

// Función para enviar mensaje a todos los clientes conectados
export function broadcastMessage(message: any) {
  const messageStr = `data: ${JSON.stringify(message)}\n\n`;
  
  console.log('🔌 [SSE] Intentando enviar mensaje a', connections.size, 'conexiones');
  
  connections.forEach((controller) => {
    try {
      controller.enqueue(messageStr);
      console.log('🔌 [SSE] Mensaje enviado a cliente');
    } catch (error) {
      console.error('🔌 [SSE] Error enviando mensaje:', error);
      connections.delete(controller);
    }
  });
}
