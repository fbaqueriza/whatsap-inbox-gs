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

interface TemplateDefinition {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

/**
 * TEMPLATES REQUERIDOS PARA EL SISTEMA
 */
const REQUIRED_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'inicializador_de_conv',
    category: 'UTILITY',
    language: 'es_AR',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}}, ¿cómo estás? Espero que andes bien. ¿En qué puedo ayudarte?'
      }
    ]
  },
  {
    name: 'evio_orden',
    category: 'UTILITY',
    language: 'es_AR',
    components: [
      {
        type: 'BODY',
        text: 'Buen día {{1}}! Espero que andes bien!\nEn cuanto me confirmes, paso el pedido de esta semana.'
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
  async setupTemplatesForUser(userId: string): Promise<{ success: boolean; error?: string; created?: number }> {
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
        const wabaId = await this.resolveWabaId(cfg);
        if (!wabaId) {
          console.warn('⚠️ [TemplateSetup] No se pudo determinar WABA_ID para esta config, se omite');
          continue;
        }

        console.log('🏢 [TemplateSetup] WABA detectada:', wabaId);

        // Verificar templates existentes por WABA
        const existingTemplates = await this.getExistingTemplates(wabaId);
        console.log('📋 [TemplateSetup] Templates existentes:', existingTemplates.length);

        // Crear templates faltantes por WABA
        for (const template of REQUIRED_TEMPLATES) {
          const exists = existingTemplates.some(t => t.name === template.name);
          if (!exists) {
            console.log(`📝 [TemplateSetup] Creando template: ${template.name}`);
            const created = await this.createTemplate(wabaId, template);
            if (created) {
              createdCount++;
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          } else {
            console.log(`✅ [TemplateSetup] Template ya existe: ${template.name}`);
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
                  const exists = existingTemplates.some(t => t.name === template.name);
                  if (!exists) {
                    console.log(`📝 [TemplateSetup] (fallback Kapso-all) Creando template en ${detWaba}: ${template.name}`);
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
      return { success: true, created: createdCount };

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
  private async getExistingTemplates(businessAccountId: string): Promise<Array<{ name: string; status: string }>> {
    try {
      const response = await fetch(
        `https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates?limit=100`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.kapsoApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [TemplateSetup] Error obteniendo templates (Kapso proxy):', response.status, errorText);
        return [];
      }

      const data = await response.json();
      return (data.data || data?.message_templates || []).map((t: any) => ({
        name: t.name,
        status: t.status
      }));

    } catch (error) {
      console.error('❌ [TemplateSetup] Error obteniendo templates existentes (Kapso proxy):', error);
      return [];
    }
  }

  /**
   * Crear un template usando el proxy de Kapso
   */
  private async createTemplate(businessAccountId: string, template: TemplateDefinition): Promise<boolean> {
    try {
      // Construir payload del template según formato de Meta API
      const components = template.components.map(comp => {
        const component: any = { type: comp.type };
        
        if (comp.type === 'BODY' && comp.text) {
          component.text = comp.text;
        }
        
        if (comp.type === 'HEADER') {
          if (comp.format) {
            component.format = comp.format;
          }
          if (comp.text) {
            component.text = comp.text;
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

      const templatePayload = {
        name: template.name,
        category: template.category,
        language: template.language,
        components: components
      };

      // Crear template usando Kapso proxy (Meta Graph proxied)
      const response = await fetch(
        `https://api.kapso.ai/meta/whatsapp/v24.0/${businessAccountId}/message_templates`,
        {
          method: 'POST',
          headers: {
            'X-API-Key': this.kapsoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(templatePayload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [TemplateSetup] Error creando template ${template.name} (Kapso proxy):`, response.status, errorText);
        return false;
      }

      const result = await response.json();
      console.log(`✅ [TemplateSetup] Template ${template.name} creado:`, result.id || result.data?.id);
      return true;

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
          const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${config.kapso_config_id}`, {
            headers: {
              'X-API-Key': this.kapsoApiKey,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const details = await response.json();
            const data = details?.data ?? details;
            const wabaFromKapso = data?.meta_business_account_id || data?.meta_whatsapp_business_account_id || data?.waba_id;
            if (wabaFromKapso) {
              console.log('🏢 [TemplateSetup] WABA desde Kapso config:', wabaFromKapso);
              return wabaFromKapso;
            }
          } else {
            console.warn('⚠️ [TemplateSetup] No se pudo obtener detalles de Kapso para WABA_ID');
          }
        } catch (kapsoError) {
          console.error('⚠️ [TemplateSetup] Error consultando Kapso para WABA_ID:', kapsoError);
        }
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
}

export const whatsappTemplateSetupService = new WhatsAppTemplateSetupService();

