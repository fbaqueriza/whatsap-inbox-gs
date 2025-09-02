/**
 * WhatsApp Error Handler - Sistema de manejo inteligente de errores
 * Maneja errores específicos de WhatsApp Business API y implementa estrategias de recuperación
 */

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

export interface ErrorHandlingResult {
  success: boolean;
  shouldRetry: boolean;
  retryDelay?: number;
  fallbackStrategy?: string;
  userMessage: string;
  technicalDetails: string;
}

export class WhatsAppErrorHandler {
  // Códigos de error de WhatsApp Business API
  private static readonly ENGAGEMENT_ERRORS = {
    131047: {
      name: 'RE_ENGAGEMENT_ERROR',
      description: 'Más de 24 horas han pasado desde la última respuesta del cliente',
      retryable: false,
      fallback: 'NOTIFY_USER_ENGAGEMENT_REQUIRED'
    },
    131049: {
      name: 'ECOSYSTEM_ENGAGEMENT_ERROR',
      description: 'Mensaje no entregado para mantener engagement saludable del ecosistema',
      retryable: false,
      fallback: 'NOTIFY_USER_ENGAGEMENT_REQUIRED'
    },
    131051: {
      name: 'RATE_LIMIT_ERROR',
      description: 'Límite de tasa excedido',
      retryable: true,
      retryDelay: 60000, // 1 minuto
      fallback: 'RETRY_WITH_DELAY'
    },
    131026: {
      name: 'INVALID_PHONE_NUMBER',
      description: 'Número de teléfono inválido',
      retryable: false,
      fallback: 'NOTIFY_INVALID_PHONE'
    },
    131027: {
      name: 'PHONE_NUMBER_NOT_REGISTERED',
      description: 'Número de teléfono no registrado en WhatsApp',
      retryable: false,
      fallback: 'NOTIFY_PHONE_NOT_REGISTERED'
    }
  };

  /**
   * Analiza un error de WhatsApp y determina la estrategia de manejo
   */
  static handleError(error: WhatsAppError, context: {
    phoneNumber: string;
    messageType: 'template' | 'text';
    attempt: number;
    maxRetries?: number;
  }): ErrorHandlingResult {
    const errorInfo = this.ENGAGEMENT_ERRORS[error.code as keyof typeof this.ENGAGEMENT_ERRORS];
    
    if (!errorInfo) {
      return this.handleUnknownError(error, context);
    }

    console.log(`🔍 [ERROR_HANDLER] Procesando error ${error.code} (${errorInfo.name}) para ${context.phoneNumber}`);

    const result: ErrorHandlingResult = {
      success: false,
      shouldRetry: errorInfo.retryable && context.attempt < (context.maxRetries || 3),
      retryDelay: errorInfo.retryDelay,
      fallbackStrategy: errorInfo.fallback,
      userMessage: this.generateUserMessage(errorInfo, context),
      technicalDetails: this.generateTechnicalDetails(error, errorInfo, context)
    };

    // Log del resultado del manejo de errores
    console.log(`📋 [ERROR_HANDLER] Resultado para ${context.phoneNumber}:`, {
      errorCode: error.code,
      errorName: errorInfo.name,
      shouldRetry: result.shouldRetry,
      retryDelay: result.retryDelay,
      fallbackStrategy: result.fallbackStrategy
    });

    return result;
  }

  /**
   * Maneja errores desconocidos
   */
  private static handleUnknownError(error: WhatsAppError, context: any): ErrorHandlingResult {
    console.warn(`⚠️ [ERROR_HANDLER] Error desconocido ${error.code} para ${context.phoneNumber}`);
    
    return {
      success: false,
      shouldRetry: false,
      userMessage: 'Error inesperado al enviar mensaje. Contacte al soporte técnico.',
      technicalDetails: `Error desconocido ${error.code}: ${error.message}`
    };
  }

  /**
   * Genera mensaje amigable para el usuario
   */
  private static generateUserMessage(errorInfo: any, context: any): string {
    switch (errorInfo.fallback) {
      case 'NOTIFY_USER_ENGAGEMENT_REQUIRED':
        return `El proveedor ${context.phoneNumber} no ha respondido en las últimas 24 horas. Se requiere interacción previa para enviar mensajes.`;
      
      case 'NOTIFY_INVALID_PHONE':
        return `El número de teléfono ${context.phoneNumber} no es válido. Verifique el formato.`;
      
      case 'NOTIFY_PHONE_NOT_REGISTERED':
        return `El número ${context.phoneNumber} no está registrado en WhatsApp.`;
      
      case 'RETRY_WITH_DELAY':
        return `Mensaje en cola de envío. Se reintentará automáticamente.`;
      
      default:
        return 'Error al enviar mensaje. Se reintentará automáticamente.';
    }
  }

  /**
   * Genera detalles técnicos para debugging
   */
  private static generateTechnicalDetails(error: WhatsAppError, errorInfo: any, context: any): string {
    return `Error ${error.code} (${errorInfo.name}): ${errorInfo.description}. 
    Contexto: ${context.messageType} message, intento ${context.attempt}, 
    teléfono: ${context.phoneNumber}`;
  }

  /**
   * Verifica si un error es de engagement
   */
  static isEngagementError(error: WhatsAppError): boolean {
    return error.code === 131047 || error.code === 131049;
  }

  /**
   * Verifica si un error es recuperable
   */
  static isRecoverableError(error: WhatsAppError): boolean {
    const errorInfo = this.ENGAGEMENT_ERRORS[error.code as keyof typeof this.ENGAGEMENT_ERRORS];
    return errorInfo?.retryable || false;
  }

  /**
   * Obtiene el delay recomendado para reintentos
   */
  static getRetryDelay(error: WhatsAppError): number {
    const errorInfo = this.ENGAGEMENT_ERRORS[error.code as keyof typeof this.ENGAGEMENT_ERRORS];
    return errorInfo?.retryDelay || 5000; // Default: 5 segundos
  }

  /**
   * Registra el error en la base de datos para análisis
   */
  static async logError(error: WhatsAppError, context: any): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Variables de entorno faltantes para log de errores');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const errorLog = {
        error_code: error.code,
        error_title: error.title,
        error_message: error.message,
        phone_number: context.phoneNumber,
        message_type: context.messageType,
        attempt: context.attempt,
        timestamp: new Date().toISOString(),
        resolved: false
      };

      const { error: insertError } = await supabase
        .from('whatsapp_error_logs')
        .insert([errorLog]);

      if (insertError) {
        console.error('❌ Error guardando log de error:', insertError);
      } else {
        console.log(`📝 [ERROR_HANDLER] Error ${error.code} registrado para ${context.phoneNumber}`);
      }
    } catch (logError) {
      console.error('❌ Error en log de errores:', logError);
    }
  }

  /**
   * Obtiene estadísticas de errores para un número de teléfono
   */
  static async getErrorStats(phoneNumber: string): Promise<{
    totalErrors: number;
    engagementErrors: number;
    lastErrorDate?: string;
    isBlocked: boolean;
  }> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        return { totalErrors: 0, engagementErrors: 0, isBlocked: false };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Obtener errores de las últimas 24 horas
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: errors, error } = await supabase
        .from('whatsapp_error_logs')
        .select('*')
        .eq('phone_number', phoneNumber)
        .gte('timestamp', twentyFourHoursAgo)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return { totalErrors: 0, engagementErrors: 0, isBlocked: false };
      }

      const totalErrors = errors?.length || 0;
      const engagementErrors = errors?.filter(e => 
        e.error_code === 131047 || e.error_code === 131049
      ).length || 0;
      
      const lastErrorDate = errors?.[0]?.timestamp;
      const isBlocked = engagementErrors >= 3; // Bloqueado si 3+ errores de engagement

      return {
        totalErrors,
        engagementErrors,
        lastErrorDate,
        isBlocked
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { totalErrors: 0, engagementErrors: 0, isBlocked: false };
    }
  }
}
