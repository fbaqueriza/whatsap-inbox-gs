import { NextResponse } from 'next/server';
import {
  buildKapsoFields,
  type ConversationKapsoExtensions,
  type ConversationRecord
} from '@kapso/whatsapp-cloud-api';
import { whatsappClient } from '@/lib/whatsapp-client';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
    const appUrl =
      searchParams.get('appUrl') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      null;
    const userId = searchParams.get('userId');
    const authHeader = request.headers.get('authorization');
    let phoneNumberId =
      searchParams.get('phoneNumberId') ||
      request.headers.get('x-phone-number-id') ||
      process.env.PHONE_NUMBER_ID ||
      null;

    if (!phoneNumberId && authHeader && appUrl && userId) {
      try {
        const response = await fetch(
          `${appUrl.replace(/\/$/, '')}/api/whatsapp/configs`,
          {
            method: 'GET',
            headers: {
              Authorization: authHeader,
            },
            cache: 'no-store',
          }
        );

        if (response.ok) {
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

          if (activeConfig) {
            phoneNumberId =
              activeConfig?.phone_number_id ??
              activeConfig?.meta_phone_number_id ??
              activeConfig?.meta_phone_id ??
              null;
          }
        } else {
          console.warn(
            '⚠️ [Conversations] No se pudo obtener phone_number_id desde appUrl:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('❌ [Conversations] Error consultando appUrl para phone_number_id:', error);
      }
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'phoneNumberId es requerido' },
        { status: 400 }
      );
    }

    const response = await whatsappClient.conversations.list({
      phoneNumberId,
      ...(status && { status: status as 'active' | 'ended' }),
      limit,
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
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
