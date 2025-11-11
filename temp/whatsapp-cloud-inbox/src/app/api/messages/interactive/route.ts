import { NextResponse } from 'next/server';
import { tryGetWhatsAppClient } from '@/lib/whatsapp-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      phoneNumber,
      header,
      body: bodyText,
      buttons,
      phoneNumberId,
      userId,
      appUrl: appUrlRaw,
    } = body as {
      phoneNumber?: string;
      header?: string;
      body?: string;
      buttons?: Array<{ id: string; title: string }>;
      phoneNumberId?: string;
      userId?: string;
      appUrl?: string;
    };

    if (!phoneNumber || !bodyText || !buttons || buttons.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: phoneNumber, body, buttons' },
        { status: 400 }
      );
    }

    const appUrl =
      appUrlRaw ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      null;
    const authHeader = request.headers.get('authorization');
    let resolvedPhoneNumberId =
      typeof phoneNumberId === 'string' && phoneNumberId.trim() !== ''
        ? phoneNumberId
        : process.env.PHONE_NUMBER_ID;

    if (!resolvedPhoneNumberId && authHeader && userId && appUrl) {
      try {
        const response = await fetch(
          `${appUrl.replace(/\/$/, '')}/api/whatsapp/configs`,
          {
            method: 'GET',
            headers: { Authorization: authHeader },
            cache: 'no-store',
          }
        );

        if (response.ok) {
          const configPayload = await response.json();
          const configs: any[] =
            configPayload?.configs ??
            configPayload?.data ??
            [];

          const activeConfig =
            configs.find((config: any) => config?.is_active) ??
            configs.find((config: any) => config?.isActive) ??
            configs[0];

          if (activeConfig) {
            resolvedPhoneNumberId =
              activeConfig?.phone_number_id ??
              activeConfig?.meta_phone_number_id ??
              activeConfig?.meta_phone_id ??
              null;
          }
        } else {
          console.warn(
            '⚠️ [MessagesInteractive] No se pudo obtener phone_number_id desde appUrl:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('❌ [MessagesInteractive] Error consultando appUrl para phone_number_id:', error);
      }
    }

    if (!resolvedPhoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required field: phoneNumberId' },
        { status: 400 }
      );
    }

    // Validate buttons
    if (buttons.length > 3) {
      return NextResponse.json(
        { error: 'Maximum 3 buttons allowed' },
        { status: 400 }
      );
    }

    // Build interactive button message payload
    const payload: {
      phoneNumberId: string;
      to: string;
      bodyText: string;
      header?: { type: 'text'; text: string };
      buttons: Array<{ id: string; title: string }>;
    } = {
      phoneNumberId: resolvedPhoneNumberId,
      to: phoneNumber,
      bodyText,
      buttons: buttons.map((btn: { id: string; title: string }) => ({
        id: btn.id,
        title: btn.title.substring(0, 20) // Ensure max 20 chars
      }))
    };

    // Add header if provided
    if (header) {
      payload.header = {
        type: 'text',
        text: header
      };
    }

    // Send interactive button message
    const whatsappClient = tryGetWhatsAppClient();

    if (!whatsappClient) {
      return NextResponse.json(
        {
          error: 'WhatsAppClient no disponible',
          detail: 'No se encontró KAPSO_API_KEY en el entorno del inbox desplegado'
        },
        { status: 400 }
      );
    }

    const result = await whatsappClient.messages.sendInteractiveButtons(payload);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sending interactive message:', error);
    return NextResponse.json(
      { error: 'Failed to send interactive message' },
      { status: 500 }
    );
  }
}
