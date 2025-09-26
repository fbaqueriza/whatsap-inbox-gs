import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

// 🔧 NUEVO: Endpoint para actualizar datos de orden con información de factura
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    const { orderId, invoiceData } = await request.json();

    if (!orderId || !invoiceData) {
      return NextResponse.json({
        success: false,
        error: 'Datos requeridos: orderId, invoiceData'
      }, { status: 400 });
    }

    // 🔧 VALIDACIÓN: Verificar que la orden existe
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, order_number, provider_id')
      .eq('id', orderId)
      .single();

    if (findError || !existingOrder) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 });
    }

    // 🔧 NUEVO: Preparar datos para actualización
    const updateData = {
      invoice_number: invoiceData.invoice_number,
      total_amount: invoiceData.total_amount,
      currency: invoiceData.currency || 'ARS',
      status: invoiceData.status || 'pago_pendiente',
      due_date: invoiceData.due_date,
      updated_at: new Date().toISOString(),
      
      // 🔧 METADATOS: Información adicional de procesamiento
      invoice_processed_at: new Date().toISOString(),
      invoice_validation_status: invoiceData.validationStatus || 'validated'
    };

    // 🔧 ACTUALIZACIÓN: Actualizar orden con datos de factura
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando orden:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error actualizando orden',
        details: updateError.message
      }, { status: 500 });
    }

    // 🔧 LOGGING: Registrar procesamiento exitoso
    console.log('✅ Orden actualizada con datos de factura:', {
      orderId: orderId,
      orderNumber: existingOrder.order_number,
      invoiceNumber: invoiceData.invoice_number,
      totalAmount: invoiceData.total_amount,
      status: invoiceData.status
    });

    return NextResponse.json({
      success: true,
      message: 'Datos de factura actualizados exitosamente',
      updatedOrder: updatedOrder,
      invoiceData: {
        invoiceNumber: invoiceData.invoice_number,
        totalAmount: invoiceData.total_amount,
        currency: invoiceData.currency,
        status: invoiceData.status,
        processedAt: updateData.invoice_processed_at
      }
    });

  } catch (error) {
    console.error('Error actualizando datos de factura:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
