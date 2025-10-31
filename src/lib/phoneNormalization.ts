/**
 * Utilidad universal para normalización de números de teléfono
 * Maneja diferentes formatos y códigos de país
 */

export interface PhoneNormalizationResult {
  normalized: string;
  original: string;
  countryCode: string;
  nationalNumber: string;
  isValid: boolean;
}

/**
 * Normaliza un número de teléfono a un formato estándar
 * Formato de salida: +[código_país][número_nacional]
 * 
 * @param phoneNumber - Número de teléfono en cualquier formato
 * @returns Objeto con información de normalización
 */
export function normalizePhoneNumber(phoneNumber: string): PhoneNormalizationResult {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      normalized: '',
      original: phoneNumber || '',
      countryCode: '',
      nationalNumber: '',
      isValid: false
    };
  }

  // Limpiar el número: remover espacios, guiones, paréntesis, etc.
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
  
  // Remover caracteres no numéricos excepto +
  cleaned = cleaned.replace(/[^\d\+]/g, '');
  
  // Si no tiene + al inicio, agregarlo
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  // Casos especiales para Argentina
  if (cleaned.startsWith('+54')) {
    // +54 11 3556 2673 -> +541135562673
    if (cleaned.length === 13) {
      return {
        normalized: cleaned,
        original: phoneNumber,
        countryCode: '54',
        nationalNumber: cleaned.substring(3),
        isValid: true
      };
    }
    
    // +549 11 3556 2673 -> +541135562673 (remover el 9 extra)
    if (cleaned.startsWith('+549') && cleaned.length === 14) {
      const withoutExtra9 = '+54' + cleaned.substring(4);
      return {
        normalized: withoutExtra9,
        original: phoneNumber,
        countryCode: '54',
        nationalNumber: cleaned.substring(4),
        isValid: true
      };
    }
  }
  
  // Casos especiales para números sin código de país (Argentina)
  if (cleaned.startsWith('+') && cleaned.length === 12) {
    // Asumir que es Argentina si empieza con 54
    if (cleaned.substring(1, 3) === '54') {
      return {
        normalized: cleaned,
        original: phoneNumber,
        countryCode: '54',
        nationalNumber: cleaned.substring(3),
        isValid: true
      };
    }
  }
  
  // Casos especiales para números sin + (Argentina)
  if (!cleaned.startsWith('+') && cleaned.length === 11) {
    // 541135562673 -> +541135562673
    if (cleaned.startsWith('54')) {
      return {
        normalized: '+' + cleaned,
        original: phoneNumber,
        countryCode: '54',
        nationalNumber: cleaned.substring(2),
        isValid: true
      };
    }
  }
  
  // Casos especiales para números sin + que empiecen con 549 (Argentina)
  if (!cleaned.startsWith('+') && cleaned.length === 12) {
    // 5491135562673 -> +541135562673 (remover el 9 extra)
    if (cleaned.startsWith('549')) {
      const withoutExtra9 = '+54' + cleaned.substring(3);
      return {
        normalized: withoutExtra9,
        original: phoneNumber,
        countryCode: '54',
        nationalNumber: cleaned.substring(3),
        isValid: true
      };
    }
  }
  
  // Casos especiales para números locales argentinos
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    // 1135562673 -> +541135562673
    if (cleaned.startsWith('11')) {
      return {
        normalized: '+54' + cleaned,
        original: phoneNumber,
        countryCode: '54',
        nationalNumber: cleaned,
        isValid: true
      };
    }
  }
  
  // Validación básica para otros países
  if (cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15) {
    // Extraer código de país (primeros 1-3 dígitos después del +)
    let countryCode = '';
    let nationalNumber = '';
    
    if (cleaned.length >= 10) {
      // Intentar extraer código de país
      for (let i = 1; i <= 3; i++) {
        const potentialCountryCode = cleaned.substring(1, 1 + i);
        const remaining = cleaned.substring(1 + i);
        
        if (remaining.length >= 7 && remaining.length <= 12) {
          countryCode = potentialCountryCode;
          nationalNumber = remaining;
          break;
        }
      }
    }
    
    return {
      normalized: cleaned,
      original: phoneNumber,
      countryCode: countryCode,
      nationalNumber: nationalNumber,
      isValid: countryCode !== '' && nationalNumber !== ''
    };
  }
  
  // Si no se puede normalizar, devolver el número limpio
  return {
    normalized: cleaned,
    original: phoneNumber,
    countryCode: '',
    nationalNumber: cleaned.replace(/^\+/, ''),
    isValid: false
  };
}

/**
 * Compara dos números de teléfono normalizados
 * @param phone1 - Primer número de teléfono
 * @param phone2 - Segundo número de teléfono
 * @returns true si los números son equivalentes
 */
export function comparePhoneNumbers(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  return normalized1.normalized === normalized2.normalized;
}

/**
 * Busca un número de teléfono en una lista de números
 * @param targetPhone - Número a buscar
 * @param phoneList - Lista de números donde buscar
 * @returns El número encontrado o null
 */
export function findMatchingPhone(targetPhone: string, phoneList: string[]): string | null {
  const normalizedTarget = normalizePhoneNumber(targetPhone);
  
  for (const phone of phoneList) {
    if (comparePhoneNumbers(targetPhone, phone)) {
      return phone;
    }
  }
  
  return null;
}

/**
 * Formatea un número de teléfono para mostrar
 * @param phoneNumber - Número de teléfono
 * @param format - Formato de salida ('international', 'national', 'local')
 * @returns Número formateado
 */
export function formatPhoneNumber(phoneNumber: string, format: 'international' | 'national' | 'local' = 'international'): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  if (!normalized.isValid) {
    return phoneNumber;
  }
  
  switch (format) {
    case 'international':
      return normalized.normalized;
    case 'national':
      if (normalized.countryCode === '54') {
        // Argentina: +541135562673 -> 11 3556-2673
        const areaCode = normalized.nationalNumber.substring(0, 2);
        const number = normalized.nationalNumber.substring(2);
        return `${areaCode} ${number.substring(0, 4)}-${number.substring(4)}`;
      }
      return normalized.nationalNumber;
    case 'local':
      return normalized.nationalNumber;
    default:
      return normalized.normalized;
  }
}
