import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerPhone, response } = body;

    if (!providerPhone || !response) {
      return NextResponse.json(
        { error: 'providerPhone y response son requeridos' },
        { status: 400 }
      );
    }

    console.log('🧪 TEST - Probando processProviderResponse con:', {
      providerPhone,
      response
    });

    // Procesar respuesta del proveedor
    const result = await OrderNotificationService.processProviderResponse(providerPhone, response);

    console.log('🧪 TEST - Resultado de processProviderResponse:', result);

    return NextResponse.json({
      success: result,
      message: result ? 'Procesamiento exitoso' : 'Procesamiento falló'
    });

  } catch (error) {
    console.error('❌ Error en test processProviderResponse:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
