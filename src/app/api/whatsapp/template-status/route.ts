import { NextRequest, NextResponse } from 'next/server';
import { templateStateService } from '../../../../lib/templateStateService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (templateId) {
      // Obtener un template específico
      const template = await templateStateService.getTemplate(templateId);
      
      if (!template) {
        return NextResponse.json(
          { error: 'Template no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json({ template });
    } else {
      // Obtener todos los templates
      const templates = await templateStateService.getAllTemplates();
      const stats = await templateStateService.getTemplateStats();

      return NextResponse.json({
        templates,
        stats,
        total: templates.length
      });
    }

  } catch (error) {
    console.error('💥 Error obteniendo estado de templates:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, templateId, status, qualityRating, componentType } = body;

    switch (action) {
      case 'update_status':
        if (!templateId || !status) {
          return NextResponse.json(
            { error: 'templateId y status son requeridos' },
            { status: 400 }
          );
        }
        await templateStateService.updateTemplateStatus(templateId, status);
        break;

      case 'update_quality':
        if (!templateId || !qualityRating) {
          return NextResponse.json(
            { error: 'templateId y qualityRating son requeridos' },
            { status: 400 }
          );
        }
        await templateStateService.updateTemplateQuality(templateId, qualityRating);
        break;

      case 'update_component':
        if (!templateId || !componentType || !status) {
          return NextResponse.json(
            { error: 'templateId, componentType y status son requeridos' },
            { status: 400 }
          );
        }
        await templateStateService.updateTemplateComponent(templateId, componentType, status);
        break;

      case 'clear_cache':
        templateStateService.clearCache();
        break;

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('💥 Error actualizando estado de templates:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
