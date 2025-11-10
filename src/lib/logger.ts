/**
 * 🧹 SISTEMA DE LOGGING LIMPIO Y EFICIENTE
 * 
 * Este sistema centraliza todos los logs y los controla según el entorno.
 * Elimina logs duplicados, excesivos y sensibles.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  maxLogLength: number;
}

class Logger {
  private config: LogConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    this.config = {
      level: this.isDevelopment ? 'debug' : 'warn',
      enableConsole: true,
      enableFile: false, // Por ahora solo console
      maxLogLength: 200 // Máximo 200 caracteres por log
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, context: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
    const prefix = `[${timestamp}] ${level.toUpperCase()} [${context}]`;
    
    let fullMessage = `${prefix} ${message}`;
    
    if (data) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      if (dataStr.length > this.config.maxLogLength) {
        fullMessage += ` ${dataStr.substring(0, this.config.maxLogLength)}...`;
      } else {
        fullMessage += ` ${dataStr}`;
      }
    }
    
    return fullMessage;
  }

  private log(level: LogLevel, context: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, context, message, data);
    
    if (this.config.enableConsole) {
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'debug':
          console.log(formattedMessage);
          break;
      }
    }
  }

  // Métodos públicos
  error(context: string, message: string, data?: any): void {
    this.log('error', context, message, data);
  }

  warn(context: string, message: string, data?: any): void {
    this.log('warn', context, message, data);
  }

  info(context: string, message: string, data?: any): void {
    this.log('info', context, message, data);
  }

  debug(context: string, message: string, data?: any): void {
    this.log('debug', context, message, data);
  }

  // Métodos específicos para casos comunes
  apiCall(context: string, method: string, url: string, status?: number): void {
    if (status) {
      this.info(context, `${method} ${url} → ${status}`);
    } else {
      this.debug(context, `${method} ${url}`);
    }
  }

  apiError(context: string, method: string, url: string, error: any): void {
    this.error(context, `${method} ${url} → ERROR`, error.message || error);
  }

  userAction(context: string, action: string, userId?: string): void {
    const userInfo = userId ? ` (user: ${userId.substring(0, 8)}...)` : '';
    this.info(context, `${action}${userInfo}`);
  }

  dataProcessed(context: string, itemType: string, count: number): void {
    this.info(context, `Procesados ${count} ${itemType}`);
  }

  // Método para configurar el nivel de log dinámicamente
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  // Método para deshabilitar logs completamente
  disable(): void {
    this.config.enableConsole = false;
  }

  // Método para habilitar logs
  enable(): void {
    this.config.enableConsole = true;
  }
}

// Instancia singleton
export const logger = new Logger();

// Exportar también la clase para casos especiales
export { Logger };