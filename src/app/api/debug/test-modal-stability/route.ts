import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    console.log('🧪 TEST - Probando estabilidad del modal:', {
      action,
      data,
      timestamp: new Date().toISOString()
    });

    // Simular diferentes acciones que podrían causar problemas
    switch (action) {
      case 'test_time_selection':
        return NextResponse.json({
          success: true,
          message: 'Selección de horario simulada exitosamente',
          action: 'time_selection',
          data: {
            selectedTimes: data?.times || ['08:00-10:00', '14:00-16:00'],
            modalState: 'open',
            dropdownState: 'closed'
          }
        });

      case 'test_date_selection':
        return NextResponse.json({
          success: true,
          message: 'Selección de fecha simulada exitosamente',
          action: 'date_selection',
          data: {
            selectedDate: data?.date || '2025-09-02',
            modalState: 'open',
            dropdownState: 'closed'
          }
        });

      case 'test_dropdown_interaction':
        return NextResponse.json({
          success: true,
          message: 'Interacción con dropdown simulada exitosamente',
          action: 'dropdown_interaction',
          data: {
            dropdownType: data?.type || 'time_selector',
            isOpen: data?.isOpen || false,
            modalState: 'open'
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no reconocida',
          availableActions: ['test_time_selection', 'test_date_selection', 'test_dropdown_interaction']
        });
    }

  } catch (error) {
    console.error('❌ Error en test modal stability:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
