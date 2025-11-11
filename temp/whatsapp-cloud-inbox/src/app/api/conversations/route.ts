import { NextResponse } from 'next/server';
import {
  buildKapsoFields,
  type ConversationKapsoExtensions,
  type ConversationRecord
} from '@kapso/whatsapp-cloud-api';
import { tryGetWhatsAppClient } from '@/lib/whatsapp-client';

function sanitizeString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null;
  }
  return trimmed;
}

function parseDirection(kapso?: ConversationKapsoExtensions): 'inbound' | 'outbound' {
  if (!kapso) {
    return 'inbound';
  }

  const inboundAt = typeof kapso.lastInboundAt === 'string' ? Date.parse(kapso.lastInboundAt) : Number.NaN;
  const outboundAt = typeof kapso.lastOutboundAt === 'string' ? Date.parse(kapso.lastOutboundAt) : Number.NaN;

  if (Number.isFinite(inboundAt) && Number.isFinite(outboundAt)) {
    return inboundAt >= outboundAt ? 'inbound' : 'outbound';
  }

  if (Number.isFinite(inboundAt)) return 'inbound';
  if (Number.isFinite(outboundAt)) return 'outbound';
  return 'inbound';
}

async function fetchPhoneNumberIdFromApp({
  appUrl,
  authHeader,
  userId,
}: {
  appUrl: string | null;
  authHeader: string | null;
  userId: string | null;
}): Promise<string | null> {
  if (!appUrl || !authHeader || !userId) {
    return null;
  }

  try {
    const response = await fetch(`${appUrl.replace(/\/$/, '')}/api/whatsapp/configs`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(
        '⚠️ [Conversations] No se pudo obtener phone_number_id desde appUrl:',
        response.status,
        response.statusText,
      );
      return null;
    }

    const configPayload = await response.json();
    const configs: any[] =
      configPayload?.configs ??
      configPayload?.data ??
      configPayload?.result ??
      [];

    const activeConfig =
      configs.find((config: any) => config?.is_active) ??
      configs.find((config: any) => config?.isActive) ??
      configs[0];

    return (
      activeConfig?.phone_number_id ??
      activeConfig?.meta_phone_number_id ??
      activeConfig?.meta_phone_id ??
      null
    );
  } catch (error) {
    console.error('❌ [Conversations] Error consultando appUrl para phone_number_id:', error);
    return null;
  }
}

async function fetchConversationsFromApp({
  appUrl,
  authHeader,
}: {
  appUrl: string | null;
  authHeader: string | null;
}) {
  if (!appUrl || !authHeader) {
    return null;
  }

  try {
    const response = await fetch(
      `${appUrl.replace(/\/$/, '')}/api/kapso/chat?action=conversations`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      console.warn(
        '⚠️ [Conversations] No se pudo obtener conversaciones desde appUrl:',
        response.status,
        response.statusText,
      );
      return null;
    }

    const payload = await response.json();
    const conversations: any[] =
      payload?.data ??
      payload?.conversations ??
      [];

    return conversations.map((conversation: any) => ({
      id: conversation.id,
      phoneNumber: conversation.phone_number ?? '',
      status: conversation.status ?? 'unknown',
      lastActiveAt: conversation.last_active_at ?? null,
      phoneNumberId: conversation.phone_number_id ?? null,
      metadata: conversation.metadata ?? {},
      contactName: conversation.contact_name ?? undefined,
      messagesCount: conversation.messages_count ?? undefined,
      lastMessage: undefined,
    }));
  } catch (error) {
    console.error('❌ [Conversations] Error consultando conversaciones en appUrl:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = sanitizeString(searchParams.get('status'));
    const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
    const appUrl = sanitizeString(
      searchParams.get('appUrl') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        null
    );
    const userId = sanitizeString(searchParams.get('userId'));
    const authHeader = sanitizeString(request.headers.get('authorization'));
    let phoneNumberId = sanitizeString(
      searchParams.get('phoneNumberId') ||
        request.headers.get('x-phone-number-id') ||
        process.env.PHONE_NUMBER_ID ||
        null
    );

    if (!phoneNumberId) {
      phoneNumberId = await fetchPhoneNumberIdFromApp({
        appUrl,
        authHeader,
        userId,
      });
    }

    const conversationsFromApp = await fetchConversationsFromApp({
      appUrl,
      authHeader,
    });

    if (Array.isArray(conversationsFromApp)) {
      const normalized = conversationsFromApp.map((conversation) => ({
        ...conversation,
        phoneNumberId: conversation.phoneNumberId ?? phoneNumberId ?? undefined,
      }));
      const limited = normalized.slice(0, limit);

      return NextResponse.json({
        data: limited,
        paging: { source: 'app' },
      });
    }

    const kapsoApiKey = process.env.KAPSO_API_KEY?.trim();
    const hasKapsoCredentials =
      kapsoApiKey &&
      kapsoApiKey.length > 0 &&
      kapsoApiKey.toLowerCase() !== 'dummy';

    console.log('ℹ️ [Conversations] Estado previo a Kapso', {
      phoneNumberId,
      hasKapsoCredentials,
      hasWhatsappClientConfigured: Boolean(process.env.KAPSO_API_KEY),
      appUrl,
      userId,
      authHeaderPresent: Boolean(authHeader),
    });

    if (!hasKapsoCredentials) {
      return NextResponse.json(
        {
          error: 'Kapso API Key no configurada',
          detail:
            'Configura la variable de entorno KAPSO_API_KEY o utiliza la plataforma principal como fuente de conversaciones.',
        },
        { status: 503 },
      );
    }

    const whatsappClient = tryGetWhatsAppClient();

    if (!phoneNumberId || !whatsappClient) {
      console.warn('⚠️ [Conversations] Falta phoneNumberId o WhatsAppClient', {
        phoneNumberId,
        hasWhatsappClient: Boolean(whatsappClient),
      });
      return NextResponse.json(
        {
          error: 'phoneNumberId es requerido o WhatsAppClient no disponible',
          detail: !phoneNumberId
            ? 'phoneNumberId es requerido'
            : 'No se encontró KAPSO_API_KEY en el entorno del inbox desplegado',
        },
        { status: 400 }
      );
    }

    const response = await whatsappClient.conversations.list({
      phoneNumberId,
      limit,
      ...(status && { status: status as 'active' | 'ended' }),
      fields: buildKapsoFields([
        'contact_name',
        'messages_count',
        'last_message_type',
        'last_message_text',
        'last_inbound_at',
        'last_outbound_at'
      ])
    });

    // Transform conversations to match frontend expectations
    const transformedData = response.data.map((conversation: ConversationRecord) => {
      const kapso = conversation.kapso;

      const lastMessageText = typeof kapso?.lastMessageText === 'string' ? kapso.lastMessageText : undefined;
      const lastMessageType = typeof kapso?.lastMessageType === 'string' ? kapso.lastMessageType : undefined;

      return {
        id: conversation.id,
        phoneNumber: conversation.phoneNumber ?? '',
        status: conversation.status ?? 'unknown',
        lastActiveAt: typeof conversation.lastActiveAt === 'string' ? conversation.lastActiveAt : undefined,
        phoneNumberId: conversation.phoneNumberId ?? phoneNumberId,
        metadata: conversation.metadata ?? {},
        contactName: typeof kapso?.contactName === 'string' ? kapso.contactName : undefined,
        messagesCount: typeof kapso?.messagesCount === 'number' ? kapso.messagesCount : undefined,
        lastMessage: lastMessageText
          ? {
              content: lastMessageText,
              direction: parseDirection(kapso),
              type: lastMessageType
            }
          : undefined
      };
    });

    return NextResponse.json({
      data: transformedData,
      paging: response.paging
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch conversations',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
