import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Servicio para obtener y guardar WABA_ID (WhatsApp Business Account ID)
 * Este servicio centraliza la lógica de obtención y almacenamiento del WABA_ID
 */
export class WabaIdService {
  /**
   * Obtener WABA_ID desde Kapso Platform API usando kapso_config_id
   */
  static async getWabaIdFromKapsoConfig(kapsoConfigId: string): Promise<string | null> {
    try {
      const KAPSO_BASE_URL = 'https://app.kapso.ai/api/v1';
      const kapsoApiKey = process.env.KAPSO_API_KEY;
      
      if (!kapsoApiKey) {
        console.warn('⚠️ [WabaIdService] KAPSO_API_KEY no configurada');
        return null;
      }

      console.log(`🔍 [WabaIdService] Obteniendo WABA_ID desde Kapso Platform para config ${kapsoConfigId}`);
      const response = await fetch(`${KAPSO_BASE_URL}/whatsapp_configs/${kapsoConfigId}`, {
        headers: {
          'X-API-Key': kapsoApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ [WabaIdService] Error obteniendo WABA_ID desde Kapso Platform: ${response.status} - ${errorText}`);
        return null;
      }
      
      const details = await response.json();
      const data = details?.data ?? details;
      // ✅ CORRECCIÓN: Buscar también business_account_id (que es lo que devuelve Kapso)
      const wabaId = data?.meta_business_account_id || data?.meta_whatsapp_business_account_id || data?.waba_id || data?.business_account_id;
      
      if (wabaId) {
        console.log(`✅ [WabaIdService] WABA_ID obtenido desde Kapso Platform: ${wabaId}`);
        return wabaId;
      }
      
      console.warn('⚠️ [WabaIdService] WABA_ID no encontrado en la respuesta de Kapso');
      return null;
    } catch (error) {
      console.error('❌ [WabaIdService] Error obteniendo WABA_ID desde Kapso Platform:', error);
      return null;
    }
  }

  /**
   * Obtener WABA_ID desde Kapso Proxy usando phone_number_id
   */
  static async getWabaIdFromPhoneNumber(phoneNumberId: string): Promise<string | null> {
    try {
      const kapsoApiKey = process.env.KAPSO_API_KEY;
      if (!kapsoApiKey) {
        return null;
      }

      console.log(`🔍 [WabaIdService] Obteniendo WABA_ID desde Kapso proxy para phone_number_id ${phoneNumberId}`);
      const response = await fetch(`https://api.kapso.ai/meta/whatsapp/v17.0/${phoneNumberId}?fields=whatsapp_business_account`, {
        headers: {
          'X-API-Key': kapsoApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`⚠️ [WabaIdService] Error obteniendo WABA_ID desde Kapso proxy: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const wabaId = data?.whatsapp_business_account?.id || data?.data?.whatsapp_business_account?.id;
      
      if (wabaId) {
        console.log(`✅ [WabaIdService] WABA_ID obtenido desde Kapso proxy: ${wabaId}`);
        return wabaId;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [WabaIdService] Error obteniendo WABA_ID desde Kapso proxy:', error);
      return null;
    }
  }

  /**
   * Obtener y guardar WABA_ID para un usuario
   * Intenta múltiples métodos para obtener el WABA_ID y lo guarda en Supabase
   */
  static async resolveAndSaveWabaId(
    userId: string,
    options?: {
      kapsoConfigId?: string;
      phoneNumberId?: string;
    }
  ): Promise<string | null> {
    try {
      console.log(`🔍 [WabaIdService] Resolviendo y guardando WABA_ID para usuario ${userId}`);
      
      let wabaId: string | null = null;

      // PRIORIDAD 1: Intentar desde kapso_config_id
      if (options?.kapsoConfigId) {
        wabaId = await this.getWabaIdFromKapsoConfig(options.kapsoConfigId);
      }

      // PRIORIDAD 2: Intentar desde phone_number_id
      if (!wabaId && options?.phoneNumberId) {
        wabaId = await this.getWabaIdFromPhoneNumber(options.phoneNumberId);
      }

      // Si encontramos WABA_ID, guardarlo en Supabase
      if (wabaId) {
        const saved = await this.saveWabaId(userId, wabaId);
        if (saved) {
          return wabaId;
        }
      }

      console.warn(`⚠️ [WabaIdService] No se pudo obtener WABA_ID para usuario ${userId}`);
      return null;
    } catch (error) {
      console.error('❌ [WabaIdService] Error resolviendo WABA_ID:', error);
      return null;
    }
  }

  /**
   * Guardar WABA_ID en Supabase para un usuario
   */
  static async saveWabaId(userId: string, wabaId: string): Promise<boolean> {
    try {
      console.log(`💾 [WabaIdService] Guardando WABA_ID ${wabaId} para usuario ${userId}`);
      
      const { error } = await supabase
        .from('user_whatsapp_config')
        .update({ waba_id: wabaId })
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (error) {
        console.error('❌ [WabaIdService] Error guardando WABA_ID:', error);
        return false;
      }
      
      console.log('✅ [WabaIdService] WABA_ID guardado exitosamente');
      return true;
    } catch (error) {
      console.error('❌ [WabaIdService] Error guardando WABA_ID:', error);
      return false;
    }
  }

  /**
   * Obtener WABA_ID guardado en Supabase para un usuario
   */
  static async getSavedWabaId(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_whatsapp_config')
        .select('waba_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      
      if (error || !data?.waba_id) {
        return null;
      }
      
      return data.waba_id;
    } catch (error) {
      console.error('❌ [WabaIdService] Error obteniendo WABA_ID guardado:', error);
      return null;
    }
  }
}

