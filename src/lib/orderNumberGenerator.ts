/**
 * Generador de códigos de orden mejorados
 * Formato: ORD-YYMMDD-PROV-XXXX
 * - YYMMDD: Fecha (año, mes, día)
 * - PROV: Código del proveedor (3-4 caracteres)
 * - XXXX: Sufijo aleatorio para unicidad
 */

/**
 * Codifica el nombre del proveedor en un código corto y legible
 * @param providerName Nombre completo del proveedor
 * @returns Código de 3-4 caracteres
 */
export function encodeProviderName(providerName: string): string {
  if (!providerName || providerName.trim().length === 0) {
    return 'PROV';
  }

  // Limpiar el nombre: remover palabras comunes y caracteres especiales
  const cleaned = providerName
    .toUpperCase()
    .replace(/\b(S\.R\.L\.|S\.A\.|S\.A\.S\.|S\.A\.C\.I\.|LTDA|INC|CORP|LLC)\b/gi, '') // Remover tipos de empresa
    .replace(/[^A-Z0-9\s]/g, '') // Remover caracteres especiales
    .trim()
    .replace(/\s+/g, ' '); // Normalizar espacios

  const words = cleaned.split(' ').filter(w => w.length > 0);

  if (words.length === 0) {
    return 'PROV';
  }

  // Estrategia 1: Si hay 1-2 palabras, tomar primeras letras (máx 4 caracteres)
  if (words.length === 1) {
    const word = words[0];
    // Si la palabra es corta (<=4), usarla completa
    if (word.length <= 4) {
      return word.padEnd(3, 'X').substring(0, 3).toUpperCase();
    }
    // Si es larga, tomar primeras 3-4 letras
    return word.substring(0, 4).toUpperCase();
  }

  if (words.length === 2) {
    // Tomar primera letra de cada palabra
    return (words[0][0] + words[1][0] + (words[1][1] || 'X')).substring(0, 3).toUpperCase();
  }

  // Estrategia 2: Si hay 3+ palabras, tomar iniciales
  if (words.length >= 3) {
    const initials = words
      .slice(0, 4) // Máximo 4 palabras
      .map(w => w[0])
      .join('');
    return initials.substring(0, 4).toUpperCase();
  }

  // Fallback: primeras 3 letras del nombre completo
  return cleaned.replace(/\s/g, '').substring(0, 3).toUpperCase();
}

/**
 * Genera un código de orden único
 * @param providerName Nombre del proveedor (opcional)
 * @param date Fecha de la orden (opcional, por defecto fecha actual)
 * @returns Código de orden en formato ORD-YYMMDD-PROV-XXXX
 */
export function generateOrderNumber(
  providerName?: string | null,
  date?: Date
): string {
  const orderDate = date || new Date();
  
  // Formato de fecha: YYMMDD
  const year = orderDate.getFullYear().toString().slice(-2);
  const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
  const day = orderDate.getDate().toString().padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  // Código del proveedor
  const providerCode = providerName 
    ? encodeProviderName(providerName)
    : 'PROV';

  // Sufijo aleatorio para unicidad (4 caracteres alfanuméricos)
  const randomSuffix = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  return `ORD-${datePart}-${providerCode}-${randomSuffix}`;
}

/**
 * Genera un código de orden con información del proveedor desde la BD
 * @param providerId ID del proveedor
 * @param supabase Cliente de Supabase
 * @param date Fecha de la orden (opcional)
 * @returns Código de orden
 */
export async function generateOrderNumberWithProvider(
  providerId: string | null | undefined,
  supabase: any,
  date?: Date
): Promise<string> {
  let providerName: string | null = null;

  if (providerId) {
    try {
      const { data: provider } = await supabase
        .from('providers')
        .select('name')
        .eq('id', providerId)
        .single();

      if (provider?.name) {
        providerName = provider.name;
      }
    } catch (error) {
      console.warn('⚠️ [OrderNumberGenerator] No se pudo obtener nombre del proveedor:', error);
    }
  }

  return generateOrderNumber(providerName, date);
}

