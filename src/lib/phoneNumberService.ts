/**
 * 🎯 SERVICIO CENTRALIZADO DE NORMALIZACIÓN DE NÚMEROS DE TELÉFONO
 * 
 * REGLA UNIFICADA: +54 + últimos 10 dígitos del número ingresado
 * 
 * Este servicio centraliza toda la lógica de normalización para evitar inconsistencias
 * entre diferentes partes del sistema (notificaciones, webhooks, chat, etc.)
 */

export class PhoneNumberService {
  /**
   * 🎯 REGLA PRINCIPAL: Normaliza cualquier número de teléfono al formato +54XXXXXXXXXX
   * 
   * @param phone - Número de teléfono en cualquier formato
   * @returns Número normalizado en formato +54XXXXXXXXXX o null si no es válido
   */
  static normalizePhoneNumber(phone: string): string | null {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // 🔧 PASO 1: Limpiar el número (remover espacios, guiones, paréntesis, etc.)
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // 🔧 PASO 2: Remover cualquier prefijo de país existente
    if (cleaned.startsWith('+54')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('54')) {
      cleaned = cleaned.substring(2);
    }
    
    // 🔧 PASO 3: Remover el 9 inicial si existe (código de área móvil argentino)
    if (cleaned.startsWith('9')) {
      cleaned = cleaned.substring(1);
    }
    
    // 🔧 PASO 4: Verificar que tenga exactamente 10 dígitos
    if (cleaned.length !== 10) {
      return null;
    }
    
    // 🔧 PASO 5: Verificar que sean solo dígitos
    if (!/^\d{10}$/.test(cleaned)) {
      return null;
    }
    
    // 🔧 PASO 6: Retornar en formato +54XXXXXXXXXX
    return `+54${cleaned}`;
  }

  /**
   * 🔍 NORMALIZACIÓN UNIFICADA PARA BÚSQUEDAS: Genera variantes consistentes con la normalización principal
   * 
   * Esta función genera variantes que son consistentes con normalizePhoneNumber
   * para evitar inconsistencias entre guardado y búsqueda
   * 
   * @param phone - Número de teléfono en cualquier formato
   * @returns Array de variantes para búsqueda
   */
  static normalizeForSearch(phone: string): string[] {
    if (!phone || typeof phone !== 'string') {
      return [];
    }

    const variants: string[] = [];
    
    // 🔧 VARIANTE 1: Número original tal como está
    variants.push(phone);
    
    // 🔧 VARIANTE 2: Número sin el + si lo tiene
    if (phone.startsWith('+')) {
      variants.push(phone.substring(1));
    } else {
      variants.push(`+${phone}`);
    }
    
    // 🔧 VARIANTE 3: Número normalizado estándar (CONSISTENTE)
    const normalized = this.normalizePhoneNumber(phone);
    if (normalized) {
      variants.push(normalized);
      
      // 🔧 VARIANTE 4: Número normalizado sin +
      variants.push(normalized.substring(1));
    }
    
    // 🔧 VARIANTE 5: Solo los últimos 10 dígitos
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (cleaned.length >= 10) {
      const last10 = cleaned.slice(-10);
      if (/^\d{10}$/.test(last10)) {
        variants.push(last10);
        variants.push(`+${last10}`);
        variants.push(`+54${last10}`);
      }
    }
    
    // 🔧 VARIANTE 6: Formato argentino con 9 inicial (CONSISTENTE con normalizePhoneNumber)
    if (cleaned.length >= 10) {
      const last10 = cleaned.slice(-10);
      if (/^\d{10}$/.test(last10)) {
        // 🔧 CORRECCIÓN: Usar el mismo formato que normalizePhoneNumber
        // normalizePhoneNumber remueve el 9 inicial, así que NO lo incluimos aquí
        // Solo incluimos el formato estándar +54XXXXXXXXXX
        variants.push(`+54${last10}`);
      }
    }
    
    // 🔧 LIMPIEZA: Remover duplicados y valores vacíos
    const uniqueVariants = [...new Set(variants)]
      .filter(variant => variant && variant.trim().length > 0)
      .slice(0, 8); // Limitar a 8 variantes máximo para eficiencia
    
    return uniqueVariants;
  }

  /**
   * 🔍 COMPARACIÓN INTELIGENTE: Verifica si dos números son equivalentes
   * 
   * @param phone1 - Primer número de teléfono
   * @param phone2 - Segundo número de teléfono
   * @returns true si los números son equivalentes
   */
  static areEquivalent(phone1: string, phone2: string): boolean {
    if (!phone1 || !phone2) {
      return false;
    }
    
    // 🔧 PASO 1: Normalizar ambos números
    const normalized1 = this.normalizePhoneNumber(phone1);
    const normalized2 = this.normalizePhoneNumber(phone2);
    
    // 🔧 PASO 2: Comparar normalizados
    if (normalized1 && normalized2) {
      return normalized1 === normalized2;
    }
    
    // 🔧 PASO 3: Si no se pueden normalizar, usar variantes de búsqueda
    const variants1 = this.normalizeForSearch(phone1);
    const variants2 = this.normalizeForSearch(phone2);
    
    // 🔧 PASO 4: Verificar si hay intersección entre variantes
    return variants1.some(v1 => variants2.includes(v1));
  }

  /**
   * 🔍 VALIDACIÓN: Verifica si un número es válido para Argentina
   * 
   * @param phone - Número de teléfono
   * @returns true si es un número argentino válido
   */
  static isValidArgentineNumber(phone: string): boolean {
    const normalized = this.normalizePhoneNumber(phone);
    if (!normalized) {
      return false;
    }
    
    // Verificar que tenga el formato +54XXXXXXXXXX
    return /^\+54\d{10}$/.test(normalized);
  }

  /**
   * 🔍 FORMATO LEGIBLE: Convierte un número normalizado a formato legible
   * 
   * @param phone - Número normalizado
   * @returns Número en formato legible (ej: +54 9 11 1234 5678)
   */
  static toReadableFormat(phone: string): string {
    const normalized = this.normalizePhoneNumber(phone);
    if (!normalized) {
      return phone;
    }
    
    // Formato: +54 9 XX XXXX XXXX
    const match = normalized.match(/^\+54(\d{1})(\d{2})(\d{4})(\d{4})$/);
    if (match) {
      return `+54 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    
    return normalized;
  }

  /**
   * 🔧 NORMALIZACIÓN UNIFICADA: Función principal que debe usarse en todo el sistema
   * 
   * Esta función asegura consistencia entre guardado y búsqueda
   * 
   * @param phone - Número de teléfono en cualquier formato
   * @returns Número normalizado en formato +54XXXXXXXXXX o null si no es válido
   */
  static normalizeUnified(phone: string): string | null {
    return this.normalizePhoneNumber(phone);
  }

  /**
   * 🔧 BÚSQUEDA UNIFICADA: Genera variantes para búsquedas consistentes
   * 
   * Esta función genera variantes que son consistentes con la normalización principal
   * para evitar inconsistencias entre guardado y búsqueda
   * 
   * @param phone - Número de teléfono en cualquier formato
   * @returns Array de variantes para búsqueda
   */
  static searchVariants(phone: string): string[] {
    return this.normalizeForSearch(phone);
  }

  /**
   * 🔧 MIGRACIÓN: Normaliza todos los números existentes en la base de datos
   * 
   * Esta función se puede ejecutar una vez para normalizar números existentes
   * y asegurar consistencia en toda la base de datos
   * 
   * @param supabase - Cliente de Supabase
   * @returns Resultado de la migración
   */
  static async migrateExistingPhoneNumbers(supabase: any): Promise<{
    success: boolean;
    totalProcessed: number;
    totalNormalized: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      totalProcessed: 0,
      totalNormalized: 0,
      errors: [] as string[]
    };

    try {
      console.log('🔄 Iniciando migración de números de teléfono existentes...');

      // 🔧 PASO 1: Normalizar números en tabla providers
      const { data: providers, error: providersError } = await supabase
        .from('providers')
        .select('id, phone, name');

      if (providersError) {
        result.errors.push(`Error obteniendo proveedores: ${providersError.message}`);
        return result;
      }

      let providersNormalized = 0;
      for (const provider of providers || []) {
        if (provider.phone) {
          const normalized = this.normalizeUnified(provider.phone);
          if (normalized && normalized !== provider.phone) {
            try {
              const { error: updateError } = await supabase
                .from('providers')
                .update({ phone: normalized })
                .eq('id', provider.id);

              if (updateError) {
                result.errors.push(`Error actualizando proveedor ${provider.name}: ${updateError.message}`);
              } else {
                providersNormalized++;
                console.log(`✅ Proveedor ${provider.name} normalizado: ${provider.phone} → ${normalized}`);
              }
            } catch (error) {
              result.errors.push(`Error procesando proveedor ${provider.name}: ${error}`);
            }
          }
        }
        result.totalProcessed++;
      }

      // 🔧 PASO 2: Normalizar números en tabla pending_orders
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('pending_orders')
        .select('id, provider_phone, order_id');

      if (pendingError) {
        result.errors.push(`Error obteniendo pedidos pendientes: ${pendingError.message}`);
      } else {
        let pendingNormalized = 0;
        for (const order of pendingOrders || []) {
          if (order.provider_phone) {
            const normalized = this.normalizeUnified(order.provider_phone);
            if (normalized && normalized !== order.provider_phone) {
              try {
                const { error: updateError } = await supabase
                  .from('pending_orders')
                  .update({ provider_phone: normalized })
                  .eq('id', order.id);

                if (updateError) {
                  result.errors.push(`Error actualizando pedido pendiente ${order.order_id}: ${updateError.message}`);
                } else {
                  pendingNormalized++;
                  console.log(`✅ Pedido pendiente ${order.order_id} normalizado: ${order.provider_phone} → ${normalized}`);
                }
              } catch (error) {
                result.errors.push(`Error procesando pedido pendiente ${order.order_id}: ${error}`);
              }
            }
          }
          result.totalProcessed++;
        }
        result.totalNormalized += pendingNormalized;
      }

      result.totalNormalized += providersNormalized;
      result.success = result.errors.length === 0;

      console.log(`✅ Migración completada:`, {
        totalProcesados: result.totalProcessed,
        totalNormalizados: result.totalNormalized,
        errores: result.errors.length
      });

      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      result.errors.push(`Error general en migración: ${errorMsg}`);
      console.error('❌ Error en migración de números de teléfono:', error);
      return result;
    }
  }
}

// 🔧 EXPORTAR FUNCIONES INDIVIDUALES PARA USO DIRECTO
export const normalizePhoneNumber = PhoneNumberService.normalizePhoneNumber;
export const normalizeForSearch = PhoneNumberService.normalizeForSearch;
export const areEquivalent = PhoneNumberService.areEquivalent;
export const isValidArgentineNumber = PhoneNumberService.isValidArgentineNumber;
export const toReadableFormat = PhoneNumberService.toReadableFormat;

// 🔧 EXPORTAR FUNCIONES UNIFICADAS (RECOMENDADAS)
export const normalizeUnified = PhoneNumberService.normalizeUnified;
export const searchVariants = PhoneNumberService.searchVariants;
