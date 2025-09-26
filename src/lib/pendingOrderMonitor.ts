import { createClient } from '@supabase/supabase-js';

interface PendingOrderEvent {
  type: 'created' | 'updated' | 'deleted';
  orderId: string;
  providerPhone: string;
  timestamp: Date;
  source: 'manual' | 'automatic' | 'realtime';
}

export class PendingOrderMonitor {
  private static events: PendingOrderEvent[] = [];
  private static isMonitoring = false;
  private static analysisInterval: NodeJS.Timeout | null = null;

  /**
   * Inicia el monitoreo de pedidos pendientes
   */
  static startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🔍 Iniciando monitoreo de pedidos pendientes...');
    
    // Limpiar eventos antiguos (más de 1 hora)
    this.events = this.events.filter(event => 
      Date.now() - event.timestamp.getTime() < 60 * 60 * 1000
    );
    
    // 🔧 OPTIMIZACIÓN: Limitar frecuencia de análisis
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    // ❌ DESHABILITADO: No usar intervalos periódicos
    // this.analysisInterval = setInterval(() => {
    //   this.analyzeDeletionPatterns();
    // }, 30000); // Analizar cada 30 segundos en lugar de en cada evento
  }

  /**
   * Registra un evento de pedido pendiente
   */
  static logEvent(event: Omit<PendingOrderEvent, 'timestamp'>) {
    const fullEvent: PendingOrderEvent = {
      ...event,
      timestamp: new Date()
    };
    
    this.events.push(fullEvent);
    console.log(`📊 Evento registrado: ${event.type} - ${event.orderId} (${event.source})`);
    
    // 🔧 OPTIMIZACIÓN: No analizar en cada evento, solo registrar
    // El análisis se hace por intervalos para mejorar rendimiento
  }

  /**
   * Analiza patrones de eliminación para detectar problemas
   */
  private static analyzeDeletionPatterns() {
    const recentEvents = this.events.filter(event => 
      Date.now() - event.timestamp.getTime() < 5 * 60 * 1000 // Últimos 5 minutos
    );

    const deletions = recentEvents.filter(event => event.type === 'deleted');
    
    if (deletions.length > 0) {
      console.log(`⚠️ Detected ${deletions.length} deletions in the last 5 minutes:`, 
        deletions.map(d => `${d.orderId} (${d.source})`)
      );
      
      // Si hay muchas eliminaciones automáticas, podría indicar un problema
      const automaticDeletions = deletions.filter(d => d.source === 'automatic');
      if (automaticDeletions.length > 2) {
        console.warn('🚨 ALERTA: Muchas eliminaciones automáticas detectadas. Posible problema en el sistema.');
      }
    }
  }

  /**
   * Obtiene el historial de eventos
   */
  static getEventHistory(): PendingOrderEvent[] {
    return [...this.events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Verifica si un pedido fue eliminado recientemente
   */
  static wasRecentlyDeleted(orderId: string, withinMinutes: number = 5): boolean {
    const cutoff = Date.now() - (withinMinutes * 60 * 1000);
    return this.events.some(event => 
      event.type === 'deleted' && 
      event.orderId === orderId && 
      event.timestamp.getTime() > cutoff
    );
  }

  /**
   * Detiene el monitoreo
   */
  static stopMonitoring() {
    this.isMonitoring = false;
    
    // 🔧 OPTIMIZACIÓN: Limpiar intervalos
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    console.log('🛑 Monitoreo de pedidos pendientes detenido');
  }
}
