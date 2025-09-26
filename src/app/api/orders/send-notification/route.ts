import { NextRequest, NextResponse } from 'next/server';
import { serverOrderFlowService } from '../../../../lib/serverOrderFlowService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ===== API SEND-NOTIFICATION INICIADO =====');
    console.log('🔍 TIMESTAMP:', new Date().toISOString());
    
    const body = await request.json();
    const { order, userId } = body;

    if (!order || !userId) {
      console.log('❌ Error: order y userId son requeridos');
      return NextResponse.json(
        { error: 'order y userId son requeridos' },
        { status: 400 }
      );
    }

    console.log('📤 Creando orden y enviando notificación:', { orderId: order.id, userId });

    // 🚀 NUEVO: Usar servicio del servidor para flujo de órdenes
    const result = await serverOrderFlowService.createOrderAndNotify(order, userId);

    console.log('📊 Resultado:', result);
    console.log('🏁 ===== API SEND-NOTIFICATION FINALIZADO =====');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en API send-notification:', error);
    console.log('🏁 ===== API SEND-NOTIFICATION ERROR =====');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}