import { NextResponse } from 'next/server';
import { whatsappClient } from '@/lib/whatsapp-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wabaId =
      searchParams.get('wabaId') ||
      request.headers.get('x-waba-id') ||
      process.env.WABA_ID ||
      null;

    if (!wabaId) {
      return NextResponse.json(
        { error: 'WABA_ID no está configurado' },
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
