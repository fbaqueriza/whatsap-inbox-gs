import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

let client: WhatsAppClient | null = null;
let initializationAttempted = false;
let initializationError: Error | null = null;

function initializeClient(): void {
  if (initializationAttempted) {
    return;
  }

  initializationAttempted = true;

  const kapsoApiKey = process.env.KAPSO_API_KEY?.trim();
  const accessToken = process.env.KAPSO_ACCESS_TOKEN?.trim();

  if (!kapsoApiKey && !accessToken) {
    initializationError = new Error('KAPSO_API_KEY o KAPSO_ACCESS_TOKEN no están configuradas');
    console.warn('⚠️ [WhatsAppClient] No se pudo inicializar WhatsAppClient: falta KAPSO_API_KEY o KAPSO_ACCESS_TOKEN');
    return;
  }

  client = new WhatsAppClient({
    baseUrl: process.env.KAPSO_API_BASE_URL || 'https://api.kapso.ai/meta/whatsapp',
    ...(kapsoApiKey ? { kapsoApiKey } : { accessToken }),
    graphVersion: process.env.KAPSO_GRAPH_VERSION || 'v24.0'
  });
}

export function getWhatsAppClient(): WhatsAppClient {
  initializeClient();

  if (!client) {
    throw initializationError ?? new Error('WhatsAppClient no pudo inicializarse');
  }

  return client;
}

export function tryGetWhatsAppClient(): WhatsAppClient | null {
  initializeClient();
  return client;
}

