import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const phoneNumberId = request.nextUrl.searchParams.get('phoneNumberId');
    if (!phoneNumberId) {
      return NextResponse.json({ success: false, error: 'phoneNumberId requerido' }, { status: 400 });
    }

    const apiKey = process.env.KAPSO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'KAPSO_API_KEY no configurada' }, { status: 500 });
    }

    const url = `https://api.kapso.ai/meta/whatsapp/v17.0/${phoneNumberId}?fields=display_name,name_status,verified_name,quality_rating,whatsapp_business_profile`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey }
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
      return NextResponse.json({ success: false, status: res.status, error: data }, { status: res.status });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Error desconocido' }, { status: 500 });
  }
}


