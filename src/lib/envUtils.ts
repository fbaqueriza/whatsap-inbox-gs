/**
 * Utilidades para variables de entorno y configuración de URLs
 */

/**
 * Obtiene la URL base de la aplicación según el entorno
 * Prioridad:
 * 1. VERCEL_URL (automático en Vercel)
 * 2. NEXT_PUBLIC_APP_URL (configurado manualmente)
 * 3. NEXT_PUBLIC_SITE_URL (alternativa)
 * 4. localhost:3001 (fallback para desarrollo)
 */
export function getBaseUrl(): string {
  // En Vercel, usar VERCEL_URL automáticamente
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Si está configurado manualmente, usar eso
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Alternativa
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Fallback a localhost para desarrollo
  return 'http://localhost:3001';
}

/**
 * Obtiene la URL del webhook de Kapso según el entorno
 */
export function getKapsoWebhookUrl(): string {
  return `${getBaseUrl()}/api/kapso/supabase-events`;
}

/**
 * Obtiene la URL del webhook de WhatsApp según el entorno
 */
export function getWhatsAppWebhookUrl(): string {
  return `${getBaseUrl()}/api/whatsapp/webhook`;
}

