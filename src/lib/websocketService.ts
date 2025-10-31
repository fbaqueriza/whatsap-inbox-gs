/**
 * Servicio de WebSocket para tiempo real
 * Conecta con el servidor para recibir actualizaciones en tiempo real
 */

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private url: string) {}

  connect(): void {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('🔌 [WebSocket] Conectado');
        this.reconnectAttempts = 0;
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 [WebSocket] Mensaje recibido:', data);
          
          // Emitir evento basado en el tipo
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch (error) {
          console.error('❌ [WebSocket] Error parseando mensaje:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 [WebSocket] Desconectado');
        this.emit('disconnected', {});
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ [WebSocket] Error:', error);
        this.emit('error', { error });
      };

    } catch (error) {
      console.error('❌ [WebSocket] Error conectando:', error);
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [WebSocket] Máximo de intentos de reconexión alcanzado');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 [WebSocket] Reintentando conexión (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ [WebSocket] No conectado, no se puede enviar mensaje');
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ [WebSocket] Error en listener de ${event}:`, error);
        }
      });
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let websocketService: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  if (!websocketService) {
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://your-domain.com/ws' 
      : 'ws://localhost:3001/ws';
    
    websocketService = new WebSocketService(wsUrl);
  }
  return websocketService;
};
