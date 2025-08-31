/**
 * Sistema de logging centralizado
 * Controla los logs en desarrollo vs producción
 */

export class Logger {
  private static isDevelopment = process.env.NODE_ENV === 'development';

  static log(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(message, data);
    }
  }

  static error(message: string, error?: any) {
    // Los errores siempre se muestran
    console.error(message, error);
  }

  static warn(message: string, data?: any) {
    // Las advertencias siempre se muestran
    console.warn(message, data);
  }

  static debug(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`🔍 [DEBUG] ${message}`, data);
    }
  }

  static info(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`ℹ️ ${message}`, data);
    }
  }

  static success(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`✅ ${message}`, data);
    }
  }

  static warning(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(`⚠️ ${message}`, data);
    }
  }
}
