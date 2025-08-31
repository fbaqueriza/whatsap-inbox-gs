import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

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

    console.log('🧪 Iniciando prueba de flujo para orden:', orderId);

    // Simular respuesta del proveedor
    const success = await OrderNotificationService.processProviderResponse(providerPhone, 'confirmo');

    if (success) {
      console.log('✅ Prueba de flujo exitosa');
      return NextResponse.json({ 
        success: true, 
        message: 'Flujo procesado correctamente',
        orderId,
        providerPhone
      });
    } else {
      console.log('❌ Prueba de flujo falló');
      return NextResponse.json({ 
        success: false, 
        message: 'No se pudo procesar el flujo',
        orderId,
        providerPhone
      });
    }

  } catch (error) {
    console.error('❌ Error en prueba de flujo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
