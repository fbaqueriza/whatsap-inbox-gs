import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '../../../../lib/templateService';

export async function GET(request: NextRequest) {
  try {
    const templates = await TemplateService.getTemplates();
    
    // Procesar y formatear los templates
    const formattedTemplates = templates.map((template: any) => ({
      id: template.id,
      name: template.name,
      status: template.status,
      category: template.category,
      language: template.language,
      components: template.components?.map((component: any) => ({
        type: component.type,
        text: component.text,
        format: component.format,
        example: component.example
      }))
    }));

    return NextResponse.json({
      success: true,
      templates: formattedTemplates,
      count: formattedTemplates.length
    });

  } catch (error) {
    console.error('❌ Error en endpoint templates:', error);
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo templates',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
