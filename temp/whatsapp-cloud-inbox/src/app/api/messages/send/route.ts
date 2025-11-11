import { NextResponse } from 'next/server';
import { tryGetWhatsAppClient } from '@/lib/whatsapp-client';

function sanitizeString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return null;
  }
  return trimmed;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const to = formData.get('to') as string;
    const body = formData.get('body') as string;
    const file = formData.get('file') as File | null;
    const phoneNumberIdRaw = formData.get('phoneNumberId');
    const userId = formData.get('userId') as string | null;
    const appUrl = sanitizeString(
      (formData.get('appUrl') as string | null) ??
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.APP_URL ??
        null
    );
    const authHeader = sanitizeString(request.headers.get('authorization'));
    let phoneNumberId = sanitizeString(
      typeof phoneNumberIdRaw === 'string' ? phoneNumberIdRaw : process.env.PHONE_NUMBER_ID ?? null
    );

    if (!to) {
      return NextResponse.json(
        { error: 'Missing required field: to' },
        { status: 400 }
      );
    }

    if (!phoneNumberId && authHeader && userId && appUrl) {
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
            phoneNumberId =
              activeConfig?.phone_number_id ??
              activeConfig?.meta_phone_number_id ??
              activeConfig?.meta_phone_id ??
              null;
          }
        } else {
          console.warn(
            '⚠️ [MessagesSend] No se pudo obtener phone_number_id desde appUrl:',
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        console.error('❌ [MessagesSend] Error consultando appUrl para phone_number_id:', error);
      }
    }

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required field: phoneNumberId' },
        { status: 400 }
      );
    }

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

    let result;

    // Send media message
    if (file) {
      const fileType = file.type.split('/')[0]; // image, video, audio, application
      const mediaType = fileType === 'application' ? 'document' : fileType;

      // Upload media first
      const uploadResult = await whatsappClient.media.upload({
        phoneNumberId,
        type: mediaType as 'image' | 'video' | 'audio' | 'document',
        file: file,
        fileName: file.name
      });

      // Send message with media
      if (mediaType === 'image') {
        result = await whatsappClient.messages.sendImage({
          phoneNumberId,
          to,
          image: { id: uploadResult.id, caption: body || undefined }
        });
      } else if (mediaType === 'video') {
        result = await whatsappClient.messages.sendVideo({
          phoneNumberId,
          to,
          video: { id: uploadResult.id, caption: body || undefined }
        });
      } else if (mediaType === 'audio') {
        result = await whatsappClient.messages.sendAudio({
          phoneNumberId,
          to,
          audio: { id: uploadResult.id }
        });
      } else {
        result = await whatsappClient.messages.sendDocument({
          phoneNumberId,
          to,
          document: { id: uploadResult.id, caption: body || undefined, filename: file.name }
        });
      }
    } else if (body) {
      // Send text message
      result = await whatsappClient.messages.sendText({
        phoneNumberId,
        to,
        body
      });
    } else {
      return NextResponse.json(
        { error: 'Either body or file is required' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
