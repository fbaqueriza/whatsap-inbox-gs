// 🔧 CONFIGURACIÓN CENTRALIZADA DEL SISTEMA

export const config = {
  // Configuración de Realtime
  realtime: {
    enabled: process.env.NEXT_PUBLIC_REALTIME_ENABLED !== 'false',
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    debounceMs: 100
  },
  
  // Configuración de logging
  logging: {
    development: process.env.NODE_ENV === 'development',
    showRealtimeLogs: false, // Disabled to reduce spam
    showDebugLogs: false, // Disabled to reduce spam
    showErrorLogs: true, // Mantener logs de error
    showInfoLogs: false // Disabled to reduce spam
  },
  
  // Configuración de WhatsApp
  whatsapp: {
    productionMode: process.env.NODE_ENV === 'production',
    templateLanguage: 'es_AR',
    maxRetries: 3
  },
  
  // Configuración de base de datos
  database: {
    maxItemsPerPage: 100,
    defaultCurrency: 'ARS',
    dateFormat: 'es-AR'
  }
};

// 🔧 FUNCIÓN PARA VERIFICAR SI REALTIME ESTÁ CONFIGURADO
export const isRealtimeConfigured = () => {
  return config.realtime.enabled;
};

// 🔧 FUNCIÓN PARA LOGGING CONDICIONAL
export const log = (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => {
  const shouldLog = 
    (level === 'error' && config.logging.showErrorLogs) ||
    (level === 'warn' && config.logging.showDebugLogs) ||
    (level === 'info' && config.logging.showInfoLogs) ||
    (level === 'debug' && config.logging.showDebugLogs);
  
  // Logs habilitados temporalmente para debug
  if (shouldLog) {
    const prefix = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level];
    
    console[level](`${prefix} ${message}`, ...args);
  }
};
