/**
 * Endpoint de debugging para ver los logs de procesamiento de facturas
 * GET /api/debug/invoice-logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const logFile = join(process.cwd(), 'temporario', 'invoice-order-logs.jsonl');
    
    // Leer el archivo de logs
    const content = await readFile(logFile, 'utf8').catch(() => '');
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay logs aún. El archivo se creará cuando se procese una factura.',
        totalLogs: 0,
        logs: [],
        file: logFile,
        fileExists: false
      });
    }
    
    // Parsear líneas JSON
    const logs = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(log => log !== null)
      .slice(-100); // Últimos 100 logs
    
    return NextResponse.json({
      success: true,
      totalLogs: logs.length,
      logs: logs,
      file: logFile,
      fileExists: true
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      logs: [],
      fileExists: false
    }, { status: 500 });
  }
}

