import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber, comparePhoneNumbers, formatPhoneNumber } from '@/lib/phoneNormalization';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone1 = searchParams.get('phone1') || '541135562673';
    const phone2 = searchParams.get('phone2') || '+541135562673';

    console.log('🔍 [Debug Phone] Probando normalización de teléfonos...');
    console.log('📱 Teléfono 1:', phone1);
    console.log('📱 Teléfono 2:', phone2);

    // Normalizar ambos números
    const normalized1 = normalizePhoneNumber(phone1);
    const normalized2 = normalizePhoneNumber(phone2);

    // Comparar números
    const areEqual = comparePhoneNumbers(phone1, phone2);

    // Formatear números
    const formatted1 = formatPhoneNumber(phone1, 'international');
    const formatted2 = formatPhoneNumber(phone2, 'international');

    const result = {
      success: true,
      phone1: {
        original: phone1,
        normalized: normalized1.normalized,
        formatted: formatted1,
        countryCode: normalized1.countryCode,
        nationalNumber: normalized1.nationalNumber,
        isValid: normalized1.isValid
      },
      phone2: {
        original: phone2,
        normalized: normalized2.normalized,
        formatted: formatted2,
        countryCode: normalized2.countryCode,
        nationalNumber: normalized2.nationalNumber,
        isValid: normalized2.isValid
      },
      comparison: {
        areEqual: areEqual,
        reason: areEqual ? 'Los números son equivalentes' : 'Los números son diferentes'
      }
    };

    console.log('📊 [Debug Phone] Resultado:', result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ [Debug Phone] Error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}
