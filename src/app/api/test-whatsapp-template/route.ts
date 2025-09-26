import { NextRequest, NextResponse } from 'next/server';
import { metaWhatsAppService } from '../../../lib/metaWhatsAppService';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 ===== TESTING WHATSAPP TEMPLATE =====');
    
    const { phoneNumber } = await request.json();
    
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'phoneNumber es requerido' },
        { status: 400 }
      );
    }

    // Datos de prueba
    const testOrder = {
      orderNumber: 'TEST-20250905-001',
      items: 'Producto de prueba',
      totalAmount: '$1000',
      deliveryDate: '2025-09-06'
    };

    console.log('📱 Enviando template de prueba a:', phoneNumber);
    console.log('🔍 Estado del servicio:', {
      isEnabled: metaWhatsAppService.isServiceEnabled(),
      isSimulationMode: metaWhatsAppService.isSimulationModeEnabled()
    });

    const result = await metaWhatsAppService.sendTemplateMessage(
      phoneNumber,
      'nueva_orden', // Template name
      {
        order_number: testOrder.orderNumber,
        items: testOrder.items,
        total_amount: testOrder.totalAmount,
        delivery_date: testOrder.deliveryDate
      }
    );

    console.log('📊 Resultado del envío:', result);
    console.log('🏁 ===== TEST COMPLETADO =====');

    return NextResponse.json({
      success: true,
      result: result,
      message: 'Template de prueba enviado'
    });

  } catch (error) {
    console.error('❌ Error en test WhatsApp:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
