/**
 * Utilidades para normalizar y manejar números de teléfono
 * 🔧 OPTIMIZADO: Usa el servicio centralizado PhoneNumberService
 */

import { PhoneNumberService } from './phoneNumberService';

/**
 * Normaliza un número de teléfono para uso consistente
 * @param phone - Número de teléfono en cualquier formato
 * @returns Número normalizado con formato +549XXXXXXXXXX
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // 🔧 OPTIMIZACIÓN: Usar servicio centralizado
  const normalized = PhoneNumberService.normalizePhoneNumber(phone);
  return normalized || '';
}

/**
 * Compara dos números de teléfono ignorando formato
 * @param phone1 - Primer número
 * @param phone2 - Segundo número
 * @returns true si son el mismo número
 */
export function phoneNumbersMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  // 🔧 OPTIMIZACIÓN: Usar servicio centralizado
  return PhoneNumberService.areEquivalent(phone1 || '', phone2 || '');
}

/**
 * Formatea un número para mostrar en la UI
 * @param phone - Número de teléfono
 * @returns Número formateado para mostrar
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  
  // Para números argentinos (+54), formatear como +54 9 11 XXXX-XXXX
  if (normalized.startsWith('+54')) {
    const digits = normalized.slice(3); // Remover +54
    if (digits.length >= 10) {
      const area = digits.slice(0, 2);
      const first = digits.slice(2, 6);
      const second = digits.slice(6, 10);
      return `+54 ${area} ${first}-${second}`;
    }
  }
  
  return normalized;
}

/**
 * Valida si un número de teléfono es válido
 * @param phone - Número de teléfono
 * @returns true si es válido
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  // 🔧 OPTIMIZACIÓN: Usar servicio centralizado
  return PhoneNumberService.isValidArgentinePhone(phone || '');
}
