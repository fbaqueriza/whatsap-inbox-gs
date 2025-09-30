import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ===== SYNC TEMPLATES INICIADO =====');
    
    // Crear cliente Supabase con service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener templates desde Meta API
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!WHATSAPP_API_KEY || !businessAccountId) {
      return NextResponse.json(
        { error: 'Variables de entorno faltantes (WHATSAPP_API_KEY o WHATSAPP_BUSINESS_ACCOUNT_ID)' },
        { status: 400 }
      );
    }

    const url = `${WHATSAPP_API_URL}/${businessAccountId}/message_templates`;
    
    console.log('🔍 Consultando templates en Meta API...');
    console.log('🔍 URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Error obteniendo templates:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Error obteniendo templates: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const templates = data.data || [];
    
    console.log('✅ Templates obtenidos exitosamente:', templates.length);
    console.log('📋 Templates disponibles:', templates.map(t => t.name));

    let syncedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;

    // Procesar cada template
    for (const template of templates) {
      try {
        console.log(`\n📋 Procesando template: ${template.name}`);
        
        // Extraer contenido del template
        const content = extractTemplateContent(template);
        
        // Preparar datos para la base de datos
        const templateData = {
          name: template.name,
          status: template.status,
          category: template.category,
          language: template.language,
          content: content,
          components: JSON.stringify(template.components || []),
          meta_id: template.id,
          created_at: template.created_time ? new Date(template.created_time * 1000).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Verificar si el template ya existe
        const { data: existingTemplate } = await supabase
          .from('whatsapp_templates')
          .select('id, name, content')
          .eq('name', template.name)
          .single();

        if (existingTemplate) {
          // Actualizar template existente
          const { error: updateError } = await supabase
            .from('whatsapp_templates')
            .update({
              status: templateData.status,
              category: templateData.category,
              language: templateData.language,
              content: templateData.content,
              components: templateData.components,
              meta_id: templateData.meta_id,
              updated_at: templateData.updated_at
            })
            .eq('name', template.name);

          if (updateError) {
            console.error(`❌ Error actualizando template ${template.name}:`, updateError);
          } else {
            console.log(`✅ Template actualizado: ${template.name}`);
            console.log(`📝 Contenido: ${content.substring(0, 100)}...`);
            updatedCount++;
          }
        } else {
          // Crear nuevo template
          const { error: insertError } = await supabase
            .from('whatsapp_templates')
            .insert([templateData]);

          if (insertError) {
            console.error(`❌ Error creando template ${template.name}:`, insertError);
          } else {
            console.log(`✅ Template creado: ${template.name}`);
            console.log(`📝 Contenido: ${content.substring(0, 100)}...`);
            createdCount++;
          }
        }

        syncedCount++;

      } catch (error) {
        console.error(`❌ Error procesando template ${template.name}:`, error);
      }
    }

    console.log(`\n📊 Resumen de sincronización:`);
    console.log(`   - Templates procesados: ${syncedCount}`);
    console.log(`   - Templates creados: ${createdCount}`);
    console.log(`   - Templates actualizados: ${updatedCount}`);

    console.log('🏁 ===== SYNC TEMPLATES FINALIZADO =====');

    return NextResponse.json({
      success: true,
      message: 'Templates sincronizados exitosamente',
      stats: {
        total: syncedCount,
        created: createdCount,
        updated: updatedCount
      }
    });

  } catch (error) {
    console.error('❌ Error en sync-templates:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * Extrae el contenido de texto de un template desde sus componentes
 */
function extractTemplateContent(template: any): string {
  try {
    if (!template.components || !Array.isArray(template.components)) {
      return '';
    }

    // Buscar el componente BODY que contiene el texto principal
    const bodyComponent = template.components.find((comp: any) => comp.type === 'BODY');
    
    if (bodyComponent && bodyComponent.text) {
      return bodyComponent.text;
    }

    // Si no hay BODY, buscar HEADER o FOOTER
    const headerComponent = template.components.find((comp: any) => comp.type === 'HEADER');
    const footerComponent = template.components.find((comp: any) => comp.type === 'FOOTER');
    
    let content = '';
    if (headerComponent && headerComponent.text) {
      content += headerComponent.text + '\n\n';
    }
    if (footerComponent && footerComponent.text) {
      content += footerComponent.text;
    }

    return content.trim();
  } catch (error) {
    console.error('❌ Error extrayendo contenido del template:', error);
    return '';
  }
}
