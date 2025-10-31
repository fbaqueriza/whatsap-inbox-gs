import { NextRequest } from 'next/server';

// Store para mantener conexiones WebSocket activas
const connections = new Set<WebSocket>();

export async function GET(request: NextRequest) {
  if (request.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  // Crear WebSocket connection
  const { socket, response } = Deno.upgradeWebSocket(request);
  
  // Agregar conexión al store
  connections.add(socket);
  
  // Manejar mensajes del cliente
  socket.onmessage = (event) => {
    console.log('🔌 [WebSocket] Mensaje recibido del cliente:', event.data);
  };
  
  // Manejar cierre de conexión
  socket.onclose = () => {
    console.log('🔌 [WebSocket] Conexión cerrada');
    connections.delete(socket);
  };
  
  // Manejar errores
  socket.onerror = (error) => {
    console.error('🔌 [WebSocket] Error:', error);
    connections.delete(socket);
  };
  
  console.log('🔌 [WebSocket] Nueva conexión establecida');
  
  return response;
}

// Función para enviar mensaje a todos los clientes conectados
export function broadcastMessage(message: any) {
  const messageStr = JSON.stringify(message);
  
  connections.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(messageStr);
      console.log('🔌 [WebSocket] Mensaje enviado a cliente');
    }
  });
}

// Función para enviar mensaje a un cliente específico
export function sendToClient(userId: string, message: any) {
  const messageStr = JSON.stringify({ ...message, userId });
  
  connections.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(messageStr);
      console.log(`🔌 [WebSocket] Mensaje enviado a usuario ${userId}`);
    }
  });
}
