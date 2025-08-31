import { NextRequest, NextResponse } from 'next/server';
import { OrderNotificationService } from '../../../../lib/orderNotificationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order, userId } = body;

    if (!order || !userId) {
      return NextResponse.json(
        { error: 'order y userId son requeridos' },
        { status: 400 }
      );
    }

    // Enviar notificación desde el servidor
    const result = await OrderNotificationService.sendOrderNotification(order, userId);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en API send-notification:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
