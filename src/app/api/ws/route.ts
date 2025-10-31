import { NextRequest } from 'next/server';
import { addConnection, removeConnection } from '../kapso/webhook/route';

export async function GET(request: NextRequest) {
  // Verificar si es una solicitud WebSocket
  if (request.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  // Crear WebSocket connection
  const { socket, response } = Deno.upgradeWebSocket(request);
  
  // Agregar conexión al store
  addConnection(socket);
  
  // Manejar mensajes del cliente
  socket.onmessage = (event) => {
    console.log('🔌 [WebSocket] Mensaje recibido del cliente:', event.data);
  };
  
  // Manejar cierre de conexión
  socket.onclose = () => {
    console.log('🔌 [WebSocket] Conexión cerrada');
    removeConnection(socket);
  };
  
  // Manejar errores
  socket.onerror = (error) => {
    console.error('🔌 [WebSocket] Error:', error);
    removeConnection(socket);
  };
  
  console.log('🔌 [WebSocket] Nueva conexión establecida');
  
  return response;
}