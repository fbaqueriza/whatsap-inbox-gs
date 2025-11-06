/**
 * Logger para el procesamiento de facturas y creación de órdenes
 * Escribe logs a un archivo para facilitar el debugging
 */

import { writeFile, appendFile } from 'fs/promises';
import { join } from 'path';

const LOG_FILE = join(process.cwd(), 'temporario', 'invoice-order-logs.jsonl');

interface LogEntry {
  timestamp: string;
  requestId: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

export class InvoiceOrderLogger {
  private static instance: InvoiceOrderLogger;
  private logs: LogEntry[] = [];
  private maxLogsInMemory = 100;

  private constructor() {
    // Crear directorio si no existe (sincrónico para asegurar que existe)
    this.ensureLogDirectorySync();
  }
  
  private ensureLogDirectorySync() {
    try {
      const { existsSync, mkdirSync } = require('fs');
      const { join } = require('path');
      const logDir = join(process.cwd(), 'temporario');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
        console.log(`📁 [Logger] Directorio creado: ${logDir}`);
      }
      console.log(`📁 [Logger] Directorio de logs verificado: ${logDir}`);
      console.log(`📁 [Logger] Archivo de logs: ${LOG_FILE}`);
    } catch (error) {
      console.error('❌ [Logger] Error creando directorio:', error);
    }
  }

  static getInstance(): InvoiceOrderLogger {
    if (!InvoiceOrderLogger.instance) {
      InvoiceOrderLogger.instance = new InvoiceOrderLogger();
    }
    return InvoiceOrderLogger.instance;
  }


  async log(level: LogEntry['level'], requestId: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      level,
      message,
      data
    };

    // Agregar a memoria
    this.logs.push(entry);
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs.shift(); // Mantener solo los últimos N logs en memoria
    }

    // También loguear en consola primero (para ver inmediatamente)
    const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : '📝';
    console.log(`${emoji} [${requestId}] ${message}`, data || '');

    // Escribir a archivo (async, no bloquea - fire and forget)
    try {
      await appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
    } catch (error: any) {
      // Si falla escribir a archivo, loguear el error detallado
      console.error('❌ [Logger] Error escribiendo log a archivo:', error);
      console.error('❌ [Logger] Ruta del archivo:', LOG_FILE);
      console.error('❌ [Logger] Error completo:', error);
      console.error('❌ [Logger] Error code:', error?.code);
      console.error('❌ [Logger] Error message:', error?.message);
    }
  }

  async info(requestId: string, message: string, data?: any) {
    return this.log('info', requestId, message, data);
  }

  async success(requestId: string, message: string, data?: any) {
    return this.log('success', requestId, message, data);
  }

  async warn(requestId: string, message: string, data?: any) {
    return this.log('warn', requestId, message, data);
  }

  async error(requestId: string, message: string, data?: any) {
    return this.log('error', requestId, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  async clearLogs() {
    try {
      await writeFile(LOG_FILE, '', 'utf8');
      this.logs = [];
    } catch (error) {
      console.error('Error limpiando logs:', error);
    }
  }
}

