import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/client';
import { TemplateService } from '../../../../lib/templateService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ===== ACTUALIZANDO MENSAJES DE TEMPLATE =====');
    
    // Obtener todos los mensajes de template que tienen contenido hardcodeado
    const { data: messages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .or('content.like.Template:%')
      .eq('message_type', 'sent');

    if (error) {
      console.error('❌ Error obteniendo mensajes:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`📋 Encontrados ${messages?.length || 0} mensajes de template para actualizar`);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay mensajes de template para actualizar',
        updated: 0 
      });
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const message of messages) {
      try {
        // Extraer el nombre del template del contenido hardcodeado
        let templateName = '';
        
        if (message.content.includes('Template: evio_orden con variables')) {
          templateName = 'evio_orden';
        } else if (message.content.includes('Template: inicializador_de_conv')) {
          templateName = 'inicializador_de_conv';
        } else if (message.content.includes('Template: ')) {
          // Extraer nombre del template del formato "Template: nombre_template"
          const match = message.content.match(/Template: ([^ ]+)/);
          if (match) {
            templateName = match[1];
          }
        }

        if (!templateName) {
          console.warn(`⚠️ No se pudo extraer nombre del template de: ${message.content}`);
          continue;
        }

        // Obtener el contenido real del template
        const templateContent = await TemplateService.getTemplateContent(templateName);
        
        // Actualizar el mensaje con el contenido real
        const { error: updateError } = await supabase
          .from('whatsapp_messages')
          .update({
            content: templateContent,
            is_template: true,
            template_name: templateName,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (updateError) {
          console.error(`❌ Error actualizando mensaje ${message.id}:`, updateError);
          errors.push(`Error actualizando mensaje ${message.id}: ${updateError.message}`);
        } else {
          updatedCount++;
          console.log(`✅ Actualizado mensaje ${message.id}: ${templateName}`);
        }

      } catch (error) {
        console.error(`❌ Error procesando mensaje ${message.id}:`, error);
        errors.push(`Error procesando mensaje ${message.id}: ${error}`);
      }
    }

    console.log(`🏁 ===== ACTUALIZACIÓN COMPLETADA =====`);
    console.log(`✅ Actualizados: ${updatedCount} mensajes`);
    console.log(`❌ Errores: ${errors.length}`);

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      total: messages.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Se actualizaron ${updatedCount} de ${messages.length} mensajes de template`
    });

  } catch (error) {
    console.error('❌ Error en actualización de mensajes:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
