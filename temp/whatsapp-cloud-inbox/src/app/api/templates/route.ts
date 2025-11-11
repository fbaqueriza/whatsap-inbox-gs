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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wabaId = sanitizeString(
      searchParams.get('wabaId') ||
        request.headers.get('x-waba-id') ||
        process.env.WABA_ID ||
        null
    );

    if (!wabaId) {
      return NextResponse.json(
        { error: 'WABA_ID no está configurado' },
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

    const response = await whatsappClient.templates.list({
      businessAccountId: wabaId,
      limit: 100
    });

    return NextResponse.json({
      data: response.data,
      paging: response.paging
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
