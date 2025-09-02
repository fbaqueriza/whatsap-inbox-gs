import { NextRequest, NextResponse } from 'next/server';
import { PhoneNumberService } from '../../../lib/phoneNumberService';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando migración de números de teléfono...');
    
    // Verificar que sea una solicitud autorizada (puedes agregar autenticación aquí)
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Variables de entorno faltantes para migración' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ejecutar migración
    const migrationResult = await PhoneNumberService.migrateExistingPhoneNumbers(supabase);

    if (migrationResult.success) {
      console.log('✅ Migración completada exitosamente');
      return NextResponse.json({
        success: true,
        message: 'Migración completada exitosamente',
        result: migrationResult
      });
    } else {
      console.error('❌ Migración completada con errores:', migrationResult.errors);
      return NextResponse.json({
        success: false,
        message: 'Migración completada con errores',
        result: migrationResult
      }, { status: 500 });
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error ejecutando migración:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: `Error ejecutando migración: ${errorMsg}` 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de migración de números de teléfono',
    usage: 'POST para ejecutar migración',
    description: 'Normaliza todos los números de teléfono existentes en la base de datos'
  });
}
