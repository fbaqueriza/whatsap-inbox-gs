/**
 * SERVICIO DE CONFIGURACIÓN AUTOMÁTICA DE TEMPLATES DE WHATSAPP
 * 
 * Este servicio se encarga de crear y sincronizar automáticamente los templates de WhatsApp
 * necesarios para el funcionamiento del sistema cuando se configura un nuevo número.
 * 
 * Templates requeridos:
 * - inicializador_de_conv: Para iniciar conversaciones después de 24 horas
 * - evio_orden: Para disparar el flujo de órdenes
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text_named_params?: Array<{ param_name: string; example: string }>;
    body_text_named_params?: Array<{ param_name: string; example: string }>;
    header_text?: string[];
    body_text?: string[];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface TemplateDefinition {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  components: TemplateComponent[];
}

/**
 * TEMPLATES REQUERIDOS PARA EL SISTEMA
 * Actualizados según documentación de Meta: https://developers.facebook.com/docs/whatsapp/message-templates/guidelines
 */
const REQUIRED_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'inicializador_de_conv', // ✅ Mantener nombre original
    category: 'UTILITY',
    language: 'es_AR', // ✅ CAMBIO: Español de España para evitar conflicto con es_AR en eliminación
    components: [
      {
        type: 'BODY',
        text: 'Hola! Este es un mensaje para que retomemos nuestra conversacion. En cuanto me respondas podemos seguir conversando.'
        // ✅ CORRECCIÓN: Este template NO tiene parámetros, solo texto estático
      }
    ]
  },
  {
    name: 'evio_orden',
    category: 'MARKETING', // ✅ CORRECCIÓN: Cambiado a MARKETING según detección de Meta
    language: 'es_AR', // ✅ CAMBIO: Español de España para evitar conflicto con es_AR en eliminación
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Nueva orden {{company_name}}',
        // ✅ CORRECCIÓN: Ejemplos requeridos para templates NAMED según documentación de Meta
        example: {
          header_text_named_params: [
            { param_name: 'company_name', example: 'Mi Empresa' }
          ]
        }
      },
      {
        type: 'BODY',
        text: 'Buen día {{contact_name}}! En cuanto me confirmes, paso el pedido.',
        // ✅ CORRECCIÓN: Ejemplos requeridos para templates NAMED según documentación de Meta
        example: {
          body_text_named_params: [
            { param_name: 'contact_name', example: 'Juan' }
          ]
        }
      }
    ]
  }
];

export class WhatsAppTemplateSetupService {
  private readonly kapsoApiKey: string;

  constructor() {
    this.kapsoApiKey = process.env.KAPSO_API_KEY || '';
    if (!this.kapsoApiKey) {
      throw new Error('KAPSO_API_KEY no está configurada en las variables de entorno');
    }
  }

  /**
   * Configurar templates automáticamente para un usuario
   * Se ejecuta después de configurar un nuevo número de WhatsApp
   */
  async setupTemplatesForUser(userId: string, providedWabaId?: string): Promise<{ success: boolean; error?: string; created?: number }> {
    try {
      console.log('🔧 [TemplateSetup] Iniciando configuración de templates para usuario:', userId);

      // Obtener TODAS las configuraciones de WhatsApp del usuario (activas e inactivas)
      const { data: configs } = await supabase
        .from('user_whatsapp_config')
        .select('phone_number_id, kapso_config_id, whatsapp_phone_number, is_active')
        .eq('user_id', userId);

      if (!configs || configs.length === 0) {
        console.warn('⚠️ [TemplateSetup] Usuario no tiene configuraciones de WhatsApp');
        return { success: false, error: 'Usuario no tiene configuraciones de WhatsApp' };
      }

      let createdCount = 0;

      for (const cfg of configs) {
        if (!cfg.phone_number_id) {
          console.warn('⚠️ [TemplateSetup] Config sin phone_number_id, se omite');
          continue;
        }

        console.log('📱 [TemplateSetup] Configuración encontrada:', {
          phoneNumberId: cfg.phone_number_id,
          phoneNumber: cfg.whatsapp_phone_number,
          isActive: cfg.is_active
        });

        // Resolver WABA_ID por cada config (evitar mezclar cuentas)
        // Usar WABA_ID proporcionado si está disponible, de lo contrario intentar resolverlo
        let wabaId = providedWabaId;
        if (!wabaId) {
          wabaId = await this.resolveWabaId(cfg);
        } else {
          console.log(`✅ [TemplateSetup] Usando WABA_ID proporcionado: ${wabaId}`);
        }
        
        if (!wabaId) {
          console.warn('⚠️ [TemplateSetup] No se pudo determinar WABA_ID para esta config, se omite');
          continue;
        }

        // ✅ Guardar WABA_ID en Supabase para futuras consultas
        try {
          const { WabaIdService } = await import('./wabaIdService');
          await WabaIdService.saveWabaId(userId, wabaId);
          console.log(`✅ [TemplateSetup] WABA_ID ${wabaId} guardado en Supabase para usuario ${userId}`);
        } catch (saveError) {
          console.warn('⚠️ [TemplateSetup] No se pudo guardar WABA_ID en Supabase:', saveError);
        }

        console.log('🏢 [TemplateSetup] WABA detectada:', wabaId);

        // Verificar templates existentes por WABA
        console.log(`🔍 [TemplateSetup] Obteniendo templates existentes para WABA: ${wabaId}`);
        const existingTemplates = await this.getExistingTemplates(wabaId);
        console.log(`📋 [TemplateSetup] Templates existentes encontrados: ${existingTemplates.length}`);
        if (existingTemplates.length > 0) {
          console.log(`📋 [TemplateSetup] Nombres de templates existentes:`, existingTemplates.map(t => t.name).join(', '));
        }

        // Crear templates faltantes por WABA
        // ✅ POLÍTICA: Solo crear si NO existe (primera vez). NUNCA recrear templates existentes.
        for (const template of REQUIRED_TEMPLATES) {
          const existingTemplate = existingTemplates.find(t => t.name === template.name);
          
          // ✅ SOLO crear si NO existe. NUNCA recrear templates existentes, sin importar su status.
          if (!existingTemplate) {
            console.log(`🔧 [TemplateSetup] Template ${template.name} NO existe, procediendo a crearlo...`);
            console.log(`🔧 [TemplateSetup] WABA_ID usado: ${wabaId}`);
            try {
              const created = await this.createTemplate(wabaId, template);
              if (created) {
                createdCount++;
                console.log(`✅ [TemplateSetup] Template ${template.name} creado exitosamente. Total creados: ${createdCount}`);
                await new Promise(resolve => setTimeout(resolve, 800));
              } else {
                console.error(`❌ [TemplateSetup] Falló la creación del template ${template.name} (createTemplate retornó false)`);
                console.error(`❌ [TemplateSetup] Revisa los logs anteriores para ver el error específico`);
              }
            } catch (error) {
              console.error(`❌ [TemplateSetup] Error inesperado creando template ${template.name}:`, error);
              console.error(`❌ [TemplateSetup] Stack:`, error instanceof Error ? error.stack : 'N/A');
            }
          } else {
            // ✅ NUNCA recrear templates existentes, sin importar su status (APPROVED, PENDING, REJECTED, etc.)
            console.log(`✅ [TemplateSetup] Template ${template.name} ya existe con status ${existingTemplate.status}, NO recrear (política: solo crear en setup inicial)`);
          }
        }
      }

      // Fallback: si no se pudo crear nada por falta de mapeo de WABA por usuario, intentar en todas las configs de Kapso
      if (createdCount === 0) {
        try {
          const listResp = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs`, {
            headers: { 'X-API-Key': this.kapsoApiKey, 'Content-Type': 'application/json' }
          });
          if (listResp.ok) {
            const listJson = await listResp.json();
            const rows = listJson?.data ?? listJson ?? [];
            for (const r of rows) {
              try {
                const detResp = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${r.id}`, {
                  headers: { 'X-API-Key': this.kapsoApiKey, 'Content-Type': 'application/json' }
                });
                if (!detResp.ok) continue;
                const detJson = await detResp.json();
                const det = detJson?.data ?? detJson ?? {};
                const detWaba = det?.meta_business_account_id || det?.meta_whatsapp_business_account_id || det?.waba_id;
                if (!detWaba) continue;
                const existingTemplates = await this.getExistingTemplates(detWaba);
                for (const template of REQUIRED_TEMPLATES) {
                  const existingTemplate = existingTemplates.find(t => t.name === template.name);
                  // ✅ CORRECCIÓN: Recrear template si no existe o si está rechazado (REJECTED)
                  const shouldCreate = !existingTemplate || existingTemplate.status === 'REJECTED';
                  
                  if (shouldCreate) {
                    if (existingTemplate && existingTemplate.status === 'REJECTED') {
                      console.log(`🔄 [TemplateSetup] (fallback) Template ${template.name} fue rechazado, recreándolo en ${detWaba}...`);
                    } else {
                      console.log(`📝 [TemplateSetup] (fallback Kapso-all) Creando template en ${detWaba}: ${template.name}`);
                    }
                    const created = await this.createTemplate(detWaba, template);
                    if (created) {
                      createdCount++;
                      await new Promise(resolve => setTimeout(resolve, 800));
                    }
                  }
                }
              } catch {}
            }
          }
        } catch {}
      }

      console.log(`✅ [TemplateSetup] Configuración completada: ${createdCount} templates creados`);
      return { 
        success: true, 
        created: createdCount
      };

    } catch (error) {
      console.error('❌ [TemplateSetup] Error configurando templates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtener templates existentes usando el proxy de Kapso (no requiere WHATSAPP_API_KEY)
   */
  private async getExistingTemplates(businessAccountId: string): Promise<Array<{ name: string; status: string; id?: string }>> {
    try {
      const response = await fetch(
        `https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates?limit=100`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.kapsoApiKey,
            'Content-Type': 'application/json'
          },
          // ✅ Agregar timeout para evitar que se cuelgue
          signal: AbortSignal.timeout(30000) // 30 segundos
        } as RequestInit
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [TemplateSetup] Error obteniendo templates (Kapso proxy):', response.status, errorText);
        return [];
      }

      const data = await response.json();
      const templates = (data.data || data?.message_templates || []).map((t: any) => {
        // ✅ Obtener ID de diferentes posibles ubicaciones en la respuesta
        const templateId = t.id || t.message_template_id || t.template_id || t.message_template?.id;
        return {
          name: t.name,
          status: (t.status || 'UNKNOWN').toUpperCase(), // ✅ Normalizar a mayúsculas para comparación
          id: templateId
        };
      });
      
      // 🔍 LOG: Mostrar templates encontrados con sus status e IDs
      if (templates.length > 0) {
        console.log(`📋 [TemplateSetup] Templates encontrados para WABA ${businessAccountId}:`, 
          templates.map(t => `${t.name} (${t.status}, ID: ${t.id || 'N/A'})`).join(', '));
      }
      
      return templates;

    } catch (error) {
      console.error('❌ [TemplateSetup] Error obteniendo templates existentes (Kapso proxy):', error);
      return [];
    }
  }

  /**
   * Eliminar un template usando el proxy de Kapso
   */
  private async deleteTemplate(businessAccountId: string, templateName: string, templateId?: string): Promise<boolean> {
    try {
      // Primero intentar obtener el template ID si no se proporcionó
      let idToDelete = templateId;
      
      if (!idToDelete) {
        const existingTemplates = await this.getExistingTemplates(businessAccountId);
        const existingTemplate = existingTemplates.find(t => t.name === templateName);
        if (existingTemplate?.id) {
          idToDelete = existingTemplate.id;
        }
      }
      
      if (!idToDelete) {
        console.warn(`⚠️ [TemplateSetup] No se pudo obtener ID del template ${templateName} para eliminar`);
        console.warn(`⚠️ [TemplateSetup] Los templates rechazados pueden no tener ID accesible por API. Intentando crear de todos modos...`);
        return false; // Retornar false pero continuar intentando crear
      }
      
      console.log(`🗑️ [TemplateSetup] Eliminando template ${templateName} (ID: ${idToDelete})...`);
      
      const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates/${idToDelete}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-API-Key': this.kapsoApiKey,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      console.log(`📥 [TemplateSetup] Delete response status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        console.log(`✅ [TemplateSetup] Template ${templateName} eliminado exitosamente`);
        return true;
      } else {
        console.warn(`⚠️ [TemplateSetup] Error eliminando template ${templateName}: ${response.status} - ${responseText}`);
        // Intentar parsear el error
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error?.message?.includes('not found') || errorData.error?.message?.includes('does not exist')) {
            console.log(`ℹ️ [TemplateSetup] Template ${templateName} no existe (ya fue eliminado o no existe)`);
            return true; // Considerar como éxito si ya no existe
          }
        } catch (e) {
          // No es JSON, continuar
        }
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [TemplateSetup] Error eliminando template ${templateName}:`, error);
      return false;
    }
  }

  /**
   * Crear un template usando el proxy de Kapso
   */
  private async createTemplate(businessAccountId: string, template: TemplateDefinition): Promise<boolean> {
    try {
            // Construir payload del template según formato de Meta API y documentación de Kapso
      const components = template.components.map(comp => {
        const component: any = { type: comp.type };

        if (comp.type === 'BODY' && comp.text) {
          component.text = comp.text;
          // ✅ CORRECCIÓN: Solo incluir example si hay parámetros en el texto
          // Si el texto NO contiene {{variable}}, no debe incluirse example
          const hasVariables = /{{.+?}}/.test(comp.text);
          if (hasVariables && comp.example?.body_text_named_params) {
            component.example = {
              body_text_named_params: comp.example.body_text_named_params
            };
          } else if (hasVariables && comp.example?.body_text) {
            component.example = {
              body_text: comp.example.body_text
            };
          }
          // Si no hay variables, no se incluye example (según documentación de Meta)
        }

        if (comp.type === 'HEADER') {
          if (comp.format) {
            component.format = comp.format;
          }
          if (comp.text) {
            component.text = comp.text;
            // ✅ CORRECCIÓN: Solo incluir example si hay parámetros en el texto
            // Si el texto NO contiene {{variable}}, no debe incluirse example
            const hasVariables = /{{.+?}}/.test(comp.text);
            if (hasVariables && comp.example?.header_text_named_params) {
              component.example = {
                header_text_named_params: comp.example.header_text_named_params
              };
            } else if (hasVariables && comp.example?.header_text) {
              component.example = {
                header_text: comp.example.header_text
              };
            }
            // Si no hay variables, no se incluye example (según documentación de Meta)
          }
        }

        if (comp.type === 'FOOTER' && comp.text) {
          component.text = comp.text;
        }

        if (comp.type === 'BUTTONS' && comp.buttons) {
          component.buttons = comp.buttons;
        }

        return component;
      });

      // ✅ CORRECCIÓN según documentación de Kapso: parameter_format debe especificarse a nivel del template
      // Determinar si el template usa parámetros NAMED (basado en si hay variables {{nombre}} en el texto)
      const hasNamedParams = components.some(comp => {
        if (comp.text && /{{[a-zA-Z_][a-zA-Z0-9_]*}}/.test(comp.text)) {
          return true; // Tiene variables nombradas ({{nombre_variable}})
        }
        return false;
      });
      
      const templatePayload: any = {
        name: template.name,
        category: template.category,
        language: template.language,
        components: components
      };
      
      // ✅ AGREGAR: parameter_format solo si hay parámetros NAMED
      if (hasNamedParams) {
        templatePayload.parameter_format = 'named';
        console.log(`✅ [TemplateSetup] Template ${template.name} usa parámetros NAMED, agregando parameter_format: "named"`);
      }

      // Crear template usando Kapso proxy (Meta Graph proxied)
      const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates`;
      console.log(`📤 [TemplateSetup] Enviando request a: ${url}`);
      console.log(`📤 [TemplateSetup] Payload:`, JSON.stringify(templatePayload, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.kapsoApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templatePayload),
        // ✅ Agregar timeout para evitar que se cuelgue
        signal: AbortSignal.timeout(60000) // 60 segundos
      } as RequestInit);

      const responseText = await response.text();
      console.log(`📥 [TemplateSetup] Response status: ${response.status} ${response.statusText}`);
      console.log(`📥 [TemplateSetup] Response body:`, responseText);

      if (!response.ok) {
        console.error(`❌ [TemplateSetup] Error creando template ${template.name} (Kapso proxy):`, response.status);
        console.error(`❌ [TemplateSetup] Error response body:`, responseText);
        
        try {
          const errorData = JSON.parse(responseText);
          const errorCode = errorData.error?.error_subcode;
          const errorMsg = errorData.error?.error_user_msg || errorData.error?.message || '';
          
          // ✅ DETECTAR: Error 2388023 o 2388025 = Meta está eliminando el template
          if (errorCode === 2388023 || errorCode === 2388025 || errorMsg.includes('is being deleted')) {
            console.warn(`⏳ [TemplateSetup] Meta está eliminando el template ${template.name}. Esperando 120 segundos antes de reintentar...`);
            console.warn(`⏳ [TemplateSetup] Mensaje: ${errorMsg}`);
            console.warn(`⏳ [TemplateSetup] Error code: ${errorCode}`);
            
            // ✅ AUMENTADO: Esperar 120 segundos (Meta puede tardar más de 90 segundos en eliminar)
            await new Promise(resolve => setTimeout(resolve, 120000));
            
            console.log(`🔄 [TemplateSetup] Reintentando crear template ${template.name} después de esperar...`);
            // Reintentar la creación
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'X-API-Key': this.kapsoApiKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(templatePayload),
              signal: AbortSignal.timeout(60000)
            } as RequestInit);
            
            const retryResponseText = await retryResponse.text();
            console.log(`📥 [TemplateSetup] Retry response status: ${retryResponse.status} ${retryResponse.statusText}`);
            
            if (retryResponse.ok) {
              try {
                const retryResult = JSON.parse(retryResponseText);
                const templateId = retryResult.id || retryResult.data?.id || retryResult.data?.message_template?.id;
                console.log(`✅ [TemplateSetup] Template ${template.name} creado exitosamente en el reintento:`, templateId);
                return true;
              } catch (parseError) {
                console.error(`❌ [TemplateSetup] Error parseando respuesta del reintento:`, parseError);
                return false;
              }
            } else {
              console.error(`❌ [TemplateSetup] Error en el reintento:`, retryResponse.status, retryResponseText);
              return false;
            }
          }
          
          // Error por template duplicado
          if (errorData.error?.message?.includes('duplicate') || errorData.error?.message?.includes('already exists')) {
            console.warn(`⚠️ [TemplateSetup] Template ${template.name} ya existe. Meta no permite crear templates con el mismo nombre incluso si están rechazados.`);
            console.warn(`⚠️ [TemplateSetup] Necesitas eliminar el template rechazado manualmente en Meta Business Manager antes de recrearlo.`);
          }
        } catch (e) {
          // No es JSON, continuar
        }
        
        return false;
      }

      try {
        const result = JSON.parse(responseText);
        const templateId = result.id || result.data?.id || result.data?.message_template?.id;
        console.log(`✅ [TemplateSetup] Template ${template.name} creado exitosamente:`, templateId);
        console.log(`✅ [TemplateSetup] Resultado completo:`, JSON.stringify(result, null, 2));
        return true;
      } catch (parseError) {
        console.error(`❌ [TemplateSetup] Error parseando respuesta para template ${template.name}:`, parseError);
        console.log(`📥 [TemplateSetup] Respuesta raw:`, responseText);
        return false;
      }

    } catch (error: any) {
      console.error(`❌ [TemplateSetup] Error creando template ${template.name} (Kapso proxy):`, error);
      return false;
    }
  }

  /**
   * Obtener WABA_ID por usuario priorizando fuentes por-usuario (evitar ENV global)
   */
  private async resolveWabaId(config: { phone_number_id?: string; kapso_config_id?: string | null }): Promise<string | null> {
    try {
      // 1) Intentar obtener de Kapso Platform (por configuración específica)
      if (config.kapso_config_id) {
        try {
          const url = `${KAPSO_BASE_URL}/whatsapp_configs/${config.kapso_config_id}`;
          console.log(`🔍 [TemplateSetup] Intentando obtener WABA_ID desde: ${url}`);
          console.log(`🔍 [TemplateSetup] kapso_config_id: ${config.kapso_config_id}`);
          
          const response = await fetch(url, {
            headers: {
              'X-API-Key': this.kapsoApiKey,
              'Content-Type': 'application/json'
            }
          });

          console.log(`🔍 [TemplateSetup] Response status: ${response.status} ${response.statusText}`);

          if (response.ok) {
            const responseText = await response.text();
            console.log(`🔍 [TemplateSetup] Response body: ${responseText.substring(0, 500)}`);
            
            try {
              const details = JSON.parse(responseText);
              const data = details?.data ?? details;
              console.log(`🔍 [TemplateSetup] Data structure keys:`, Object.keys(data).join(', '));
              
              // ✅ CORRECCIÓN: Buscar también business_account_id (que es lo que devuelve Kapso)
              const wabaFromKapso = data?.meta_business_account_id || data?.meta_whatsapp_business_account_id || data?.waba_id || data?.business_account_id;
              console.log(`🔍 [TemplateSetup] WABA encontrado en campos:`, {
                'meta_business_account_id': data?.meta_business_account_id,
                'meta_whatsapp_business_account_id': data?.meta_whatsapp_business_account_id,
                'waba_id': data?.waba_id,
                'business_account_id': data?.business_account_id, // ✅ NUEVO: Campo que realmente devuelve Kapso
                'final_waba': wabaFromKapso
              });
              
              if (wabaFromKapso) {
                console.log('✅ [TemplateSetup] WABA desde Kapso config:', wabaFromKapso);
                return wabaFromKapso;
              } else {
                console.warn('⚠️ [TemplateSetup] WABA_ID no encontrado en la respuesta de Kapso');
              }
            } catch (parseError) {
              console.error('❌ [TemplateSetup] Error parseando respuesta de Kapso:', parseError);
              console.log(`❌ [TemplateSetup] Response text completo: ${responseText}`);
            }
          } else {
            const errorText = await response.text().catch(() => 'No se pudo obtener error');
            console.warn(`⚠️ [TemplateSetup] Error obteniendo detalles de Kapso para WABA_ID: ${response.status} - ${errorText}`);
          }
        } catch (kapsoError) {
          console.error('❌ [TemplateSetup] Error consultando Kapso para WABA_ID:', kapsoError);
          if (kapsoError instanceof Error) {
            console.error('❌ [TemplateSetup] Stack trace:', kapsoError.stack);
          }
        }
      } else {
        console.warn('⚠️ [TemplateSetup] No hay kapso_config_id en la configuración');
      }

      // 1b) Buscar en Kapso Platform por número si no tenemos kapso_config_id
      try {
        const listResp = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs`, {
          headers: {
            'X-API-Key': this.kapsoApiKey,
            'Content-Type': 'application/json'
          }
        });
        if (listResp.ok) {
          const listJson = await listResp.json();
          const rows = listJson?.data ?? listJson ?? [];
          try {
            console.log('📒 [TemplateSetup] Kapso whatsapp_configs disponibles:', rows.map((r:any)=>({id:r?.id, phone_number:r?.phone_number||r?.whatsapp_phone_number, meta_phone_number_id:r?.meta_phone_number_id||r?.phone_number_id, waba:r?.meta_business_account_id||r?.meta_whatsapp_business_account_id||r?.waba_id})).slice(0,10));
          } catch {}
          // Intentar casar por detalle si el listado es incompleto
          for (const r of rows) {
            try {
              const detResp = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${r.id}`, {
                headers: {
                  'X-API-Key': this.kapsoApiKey,
                  'Content-Type': 'application/json'
                }
              });
              if (!detResp.ok) continue;
              const detJson = await detResp.json();
              const det = detJson?.data ?? detJson ?? {};
              const detPhone = det?.phone_number || det?.whatsapp_phone_number;
              const detPhoneId = det?.meta_phone_number_id || det?.phone_number_id;
              const detWaba = det?.meta_business_account_id || det?.meta_whatsapp_business_account_id || det?.waba_id;
              if ((config as any).whatsapp_phone_number && detPhone === (config as any).whatsapp_phone_number ||
                  config.phone_number_id && detPhoneId === config.phone_number_id) {
                if (detWaba) {
                  console.log('🏢 [TemplateSetup] WABA desde Kapso config:', detWaba);
                  return detWaba;
                }
              }
            } catch {}
          }
        }
      } catch (kapsoListError) {
        console.warn('⚠️ [TemplateSetup] No se pudo mapear WABA desde listado de Kapso:', kapsoListError);
      }

      // 2) Consultar vía Kapso proxy por phone_number_id (no requiere WHATSAPP_API_KEY)
      if (config.phone_number_id) {
        try {
          const response = await fetch(`https://api.kapso.ai/meta/whatsapp/v17.0/${config.phone_number_id}?fields=whatsapp_business_account`, {
            headers: {
              'X-API-Key': this.kapsoApiKey,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const data = await response.json();
            const wabaFromProxy = data?.whatsapp_business_account?.id || data?.data?.whatsapp_business_account?.id;
            if (wabaFromProxy) {
              console.log('🏢 [TemplateSetup] WABA desde Kapso proxy:', wabaFromProxy);
              return wabaFromProxy;
            }
          } else {
            const t = await response.text();
            console.warn('⚠️ [TemplateSetup] No se pudo obtener WABA por proxy:', response.status, t);
          }
        } catch (proxyError) {
          console.error('⚠️ [TemplateSetup] Error consultando Kapso proxy para WABA_ID:', proxyError);
        }
      }

      // 3) ÚLTIMO recurso: variables de entorno (puede apuntar a otra WABA)
      const envWabaId = process.env.WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
      if (envWabaId) {
        console.warn('⚠️ [TemplateSetup] Usando WABA_ID de entorno como último recurso:', envWabaId);
        return envWabaId;
      }

            return null;
    } catch (error) {
      console.error('❌ [TemplateSetup] Error resolviendo WABA_ID:', error);    
      return null;
    }
  }

  /**
   * Configurar templates para TODOS los usuarios existentes con WhatsApp configurado
   * Útil para migrar usuarios que ya tenían WhatsApp antes de esta funcionalidad
   */
  async setupTemplatesForAllUsers(providedWabaIds?: Record<string, string>): Promise<{ success: boolean; processed: number; created: number; errors: string[]; details?: Array<{ userId: string; wabaId?: string | null; existingTemplates: string[]; created: string[]; errors: string[] }> }> {
    try {
      console.log('🚀 [TemplateSetup] Iniciando configuración de templates para todos los usuarios...');

      // Obtener todos los usuarios con configuración de WhatsApp activa
      const { data: configs, error: configsError } = await supabase
        .from('user_whatsapp_config')
        .select('user_id')
        .eq('is_active', true);

      if (configsError) {
        console.error('❌ [TemplateSetup] Error obteniendo configuraciones:', configsError);
        return {
          success: false,
          processed: 0,
          created: 0,
          errors: [configsError.message]
        };
      }

      if (!configs || configs.length === 0) {
        console.log('ℹ️ [TemplateSetup] No hay usuarios con WhatsApp configurado');
        return {
          success: true,
          processed: 0,
          created: 0,
          errors: []
        };
      }

      // Obtener usuarios únicos
      let uniqueUserIds = Array.from(new Set(configs.map(c => c.user_id)));
      
      // Si se proporcionaron WABA_IDs específicos, procesar solo esos usuarios
      if (providedWabaIds && Object.keys(providedWabaIds).length > 0) {
        const providedUserIds = Object.keys(providedWabaIds);
        // Incluir usuarios proporcionados que no estén en la base de datos
        const allProvidedUserIds = new Set([...uniqueUserIds, ...providedUserIds]);
        uniqueUserIds = Array.from(allProvidedUserIds).filter(userId => providedUserIds.includes(userId));
        console.log(`📊 [TemplateSetup] Filtrando usuarios: procesando solo ${uniqueUserIds.length} usuarios especificados en wabaIds`);
      }
      
      console.log(`📊 [TemplateSetup] Procesando ${uniqueUserIds.length} usuarios con WhatsApp configurado`);

      let totalCreated = 0;
      const errors: string[] = [];
      const details: Array<{ userId: string; wabaId?: string | null; existingTemplates: string[]; created: string[]; errors: string[] }> = [];

      // Procesar cada usuario
      for (const userId of uniqueUserIds) {
        try {
          console.log(`🔄 [TemplateSetup] Procesando usuario: ${userId}`);
          const userDetail: { userId: string; wabaId?: string | null; existingTemplates: string[]; created: string[]; errors: string[] } = {
            userId,
            existingTemplates: [],
            created: [],
            errors: []
          };

          // Obtener configuraciones del usuario para obtener WABA_ID
          const { data: userConfigs } = await supabase
            .from('user_whatsapp_config')
            .select('phone_number_id, kapso_config_id, whatsapp_phone_number')
            .eq('user_id', userId);

          // Usar WABA_ID proporcionado directamente si está disponible
          if (providedWabaIds && providedWabaIds[userId]) {
            userDetail.wabaId = providedWabaIds[userId];
            console.log(`✅ [TemplateSetup] Usando WABA_ID proporcionado para usuario ${userId}: ${providedWabaIds[userId]}`);
            
            if (providedWabaIds[userId]) {
              // Obtener templates existentes
              const existingTemplates = await this.getExistingTemplates(providedWabaIds[userId]);
              userDetail.existingTemplates = existingTemplates.map(t => t.name);
            }
          } else if (userConfigs && userConfigs.length > 0) {
            // Intentar resolver WABA_ID automáticamente
            const firstConfig = userConfigs[0];
            if (firstConfig.phone_number_id) {
              const wabaId = await this.resolveWabaId(firstConfig);
              userDetail.wabaId = wabaId;

              if (wabaId) {
                // Obtener templates existentes
                const existingTemplates = await this.getExistingTemplates(wabaId);
                userDetail.existingTemplates = existingTemplates.map(t => t.name);
              }
            }
          }

          // Si tenemos WABA_ID, usarlo para forzar la creación de templates
          let result;
          if (userDetail.wabaId) {
            // Llamar directamente a setupTemplatesForUser pero con WABA_ID conocido
            // Necesitamos modificar setupTemplatesForUser para aceptar WABA_ID opcional
            result = await this.setupTemplatesForUser(userId, userDetail.wabaId);
          } else {
            result = await this.setupTemplatesForUser(userId);
          }
          if (result.success && result.created) {
            totalCreated += result.created;
            // No podemos saber exactamente cuáles se crearon sin modificar setupTemplatesForUser
            // Por ahora, asumimos que si result.created > 0, se crearon templates
            if (result.created > 0) {
              userDetail.created = ['evio_orden', 'inicializador_de_conv'].filter(
                name => !userDetail.existingTemplates.includes(name)
              );
            }
            console.log(`✅ [TemplateSetup] Usuario ${userId}: ${result.created} templates creados`);
          } else if (result.error) {
            userDetail.errors.push(result.error);
            errors.push(`Usuario ${userId}: ${result.error}`);
            console.warn(`⚠️ [TemplateSetup] Usuario ${userId}: ${result.error}`);
          }

          details.push(userDetail);
          // Esperar un poco entre usuarios para no sobrecargar la API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
          errors.push(`Usuario ${userId}: ${errorMsg}`);
          details.push({
            userId,
            existingTemplates: [],
            created: [],
            errors: [errorMsg]
          });
          console.error(`❌ [TemplateSetup] Error procesando usuario ${userId}:`, error);
        }
      }

      console.log(`✅ [TemplateSetup] Procesamiento completado: ${totalCreated} templates creados para ${uniqueUserIds.length} usuarios`);
      return {
        success: true,
        processed: uniqueUserIds.length,
        created: totalCreated,
        errors,
        details
      };

    } catch (error) {
      console.error('❌ [TemplateSetup] Error en setupTemplatesForAllUsers:', error);
      return {
        success: false,
        processed: 0,
        created: 0,
        errors: [error instanceof Error ? error.message : 'Error desconocido']
      };
    }
  }
}

export const whatsappTemplateSetupService = new WhatsAppTemplateSetupService();

