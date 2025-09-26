import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '../../../../lib/notificationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, providerPhone } = body;

    if (!orderId || !providerPhone) {
      return NextResponse.json(
        { error: 'orderId y providerPhone son requeridos' },
        { status: 400 }
      );
    }

    console.log('🧪 Probando flujo completo:', { orderId, providerPhone });

    // Simular respuesta de confirmación del proveedor
    const result = await OrderNotificationService.processProviderResponse(
      providerPhone,
      'confirmo'
    );

    return NextResponse.json({
      success: result,
      message: result ? 'Flujo completado exitosamente' : 'Error en el flujo',
      orderId,
      providerPhone
    });

  } catch (error) {
    console.error('❌ Error en test-full-flow:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
