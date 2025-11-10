import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface WhatsAppConfig {
  id: string;
  user_id: string;
  phone_number: string;
  kapso_config_id?: string;
  meta_phone_number_id?: string;
  meta_access_token?: string;
  is_sandbox: boolean;
  is_active: boolean;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWhatsAppConfigRequest {
  phone_number: string;
  is_sandbox?: boolean;
  webhook_url?: string;
  kapso_config_id?: string;
}

export class WhatsAppConfigService {
  /**
   * Crear una nueva configuración de WhatsApp para un usuario
   */
  static async createConfig(
    userId: string, 
    configData: CreateWhatsAppConfigRequest
  ): Promise<{ success: boolean; config?: WhatsAppConfig; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Creando configuración para usuario:', userId);
      console.log('📱 [WhatsAppConfig] Datos:', configData);

      // Verificar si el usuario ya tiene una configuración activa
      const existingConfig = await this.getActiveConfig(userId);
      if (existingConfig.success && existingConfig.config) {
        return {
          success: false,
          error: 'El usuario ya tiene una configuración de WhatsApp activa'
        };
      }

      // Crear la configuración en la base de datos
      const { data, error } = await supabase
        .from('user_whatsapp_config')
        .insert([{
          user_id: userId,
          phone_number: configData.phone_number,
          is_sandbox: configData.is_sandbox || false,
          webhook_url: configData.webhook_url,
          kapso_config_id: configData.kapso_config_id, // 🔧 CORRECCIÓN: Guardar kapso_config_id
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ [WhatsAppConfig] Error creando configuración:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [WhatsAppConfig] Configuración creada exitosamente:', data);
      return {
        success: true,
        config: data as WhatsAppConfig
      };

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error inesperado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener la configuración activa de un usuario
   */
  static async getActiveConfig(userId: string): Promise<{ success: boolean; config?: WhatsAppConfig; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Obteniendo configuración activa para usuario:', userId);

      const { data, error } = await supabase
        .from('user_whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No se encontró configuración activa
          console.log('ℹ️ [WhatsAppConfig] No hay configuración activa para el usuario');
          return {
            success: true,
            config: undefined
          };
        }
        
        console.error('❌ [WhatsAppConfig] Error obteniendo configuración:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [WhatsAppConfig] Configuración encontrada:', data);
      return {
        success: true,
        config: data as WhatsAppConfig
      };

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error inesperado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener todas las configuraciones de un usuario
   */
  static async getUserConfigs(userId: string): Promise<{ success: boolean; configs?: WhatsAppConfig[]; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Obteniendo todas las configuraciones para usuario:', userId);

      const { data, error } = await supabase
        .from('user_whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [WhatsAppConfig] Error obteniendo configuraciones:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [WhatsAppConfig] Configuraciones encontradas:', data?.length || 0);
      return {
        success: true,
        configs: data as WhatsAppConfig[]
      };

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error inesperado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }


  /**
   * Desactivar una configuración (marcar como inactiva)
   */
  static async deactivateConfig(configId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Desactivando configuración:', configId);

      const { error } = await supabase
        .from('user_whatsapp_config')
        .update({ is_active: false })
        .eq('id', configId);

      if (error) {
        console.error('❌ [WhatsAppConfig] Error desactivando configuración:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [WhatsAppConfig] Configuración desactivada exitosamente');
      return {
        success: true
      };

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error inesperado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar una configuración
   */
  static async deleteConfig(configId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Eliminando configuración:', configId);

      const { error } = await supabase
        .from('user_whatsapp_config')
        .delete()
        .eq('id', configId);

      if (error) {
        console.error('❌ [WhatsAppConfig] Error eliminando configuración:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [WhatsAppConfig] Configuración eliminada exitosamente');
      return {
        success: true
      };

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error inesperado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Actualizar una configuración de WhatsApp existente
   */
  static async updateConfig(
    configId: string,
    updateData: Partial<CreateWhatsAppConfigRequest & { is_active?: boolean }>,
    userId: string
  ): Promise<{ success: boolean; config?: WhatsAppConfig; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Actualizando configuración:', configId);
      console.log('📱 [WhatsAppConfig] Datos de actualización:', updateData);

      // Verificar que la configuración pertenece al usuario
      const { data: existingConfig, error: fetchError } = await supabase
        .from('user_whatsapp_config')
        .select('*')
        .eq('id', configId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingConfig) {
        return {
          success: false,
          error: 'Configuración no encontrada o no tienes permisos para modificarla'
        };
      }

      // Preparar datos de actualización
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      };

      if (updateData.phone_number !== undefined) {
        updatePayload.phone_number = updateData.phone_number;
      }
      if (updateData.is_sandbox !== undefined) {
        updatePayload.is_sandbox = updateData.is_sandbox;
      }
      if (updateData.webhook_url !== undefined) {
        updatePayload.webhook_url = updateData.webhook_url;
      }
      if (updateData.is_active !== undefined) {
        updatePayload.is_active = updateData.is_active;
      }
      if (updateData.kapso_config_id !== undefined) {
        updatePayload.kapso_config_id = updateData.kapso_config_id;
      }

      // Actualizar la configuración
      const { data, error } = await supabase
        .from('user_whatsapp_config')
        .update(updatePayload)
        .eq('id', configId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ [WhatsAppConfig] Error actualizando configuración:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ [WhatsAppConfig] Configuración actualizada exitosamente');
      return {
        success: true,
        config: data
      };

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error inesperado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear configuración automática para un usuario nuevo
   * Usa el número de sandbox de Kapso por defecto
   */
  static async createDefaultConfig(userId: string): Promise<{ success: boolean; config?: WhatsAppConfig; error?: string }> {
    try {
      console.log('📱 [WhatsAppConfig] Creando configuración por defecto para usuario:', userId);

      // Por ahora, crear una configuración con número de sandbox
      // TODO: Integrar con Kapso API para obtener el número de sandbox real
      const defaultConfig: CreateWhatsAppConfigRequest = {
        phone_number: '+549112345678', // Número de sandbox temporal
        is_sandbox: true,
        webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/whatsapp/webhook`
      };

      return await this.createConfig(userId, defaultConfig);

    } catch (error: any) {
      console.error('❌ [WhatsAppConfig] Error creando configuración por defecto:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
