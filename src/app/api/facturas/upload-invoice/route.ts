import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar a Supabase'
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const providerId = formData.get('providerId') as string;
    const orderId = formData.get('orderId') as string;

    if (!file || !providerId) {
      return NextResponse.json({
        success: false,
        error: 'Archivo y proveedor son requeridos'
      }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se permiten archivos PDF e imágenes'
      }, { status: 400 });
    }

    // Generar nombre único para el archivo
    const fileName = `invoice_${Date.now()}_${file.name}`;
    const filePath = `invoices/${providerId}/${fileName}`;

    // Subir archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      return NextResponse.json({
        success: false,
        error: 'Error subiendo archivo',
        details: uploadError.message
      }, { status: 500 });
    }

    // Obtener URL pública del archivo
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // Si se especificó una orden específica, asociarla directamente
    if (orderId) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          receipt_url: publicUrl,
          status: 'invoice_received',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: 'Error asociando factura a orden',
          details: updateError.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Factura asociada a orden exitosamente',
        orderId,
        fileUrl: publicUrl
      });
    }

    // Si no se especificó orden, buscar la más reciente del proveedor
    const { data: latestOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount')
      .eq('provider_id', providerId)
      .is('receipt_url', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (orderError || !latestOrder || latestOrder.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron órdenes pendientes para este proveedor'
      }, { status: 404 });
    }

    const orderToUpdate = latestOrder[0];

    // Asociar factura a la orden más reciente
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        receipt_url: publicUrl,
        status: 'invoice_received',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderToUpdate.id);

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Error asociando factura a orden',
        details: updateError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Factura procesada y asociada automáticamente',
      orderId: orderToUpdate.id,
      orderNumber: orderToUpdate.order_number,
      fileUrl: publicUrl
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
