/**
 * 🔧 SCRIPT DE PRUEBA DE NORMALIZACIÓN UNIFICADA
 * 
 * Este script prueba que la normalización de números de teléfono esté funcionando
 * correctamente con el formato unificado +549XXXXXXXXXX
 */

import { PhoneNumberService } from '../lib/phoneNumberService';

/**
 * 🔧 FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function testPhoneNormalization() {
  console.log('🧪 Iniciando pruebas de normalización unificada...');
  console.log('📱 Formato objetivo: +549XXXXXXXXXX');
  console.log('---');

  // 🔧 CASOS DE PRUEBA
  const testCases = [
    // Formato largo (webhook)
    '+5491135562673',
    '5491135562673',
    '5491135562673',
    
    // Formato corto (base de datos)
    '+541135562673',
    '541135562673',
    '541135562673',
    
    // Formato sin prefijo
    '1135562673',
    '01135562673',
    '01135562673',
    
    // Formato con espacios y guiones
    '+54 9 11 3556 2673',
    '54-9-11-3556-2673',
    '54 9 11 3556 2673',
    
    // Formato argentino estándar
    '+54 9 11 3556 2673',
    '54 9 11 3556 2673',
    '54 9 11 3556 2673',
    
    // Casos edge
    '91135562673',
    '091135562673',
    '091135562673'
  ];

  console.log('📋 Ejecutando casos de prueba...');
  console.log('');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      // 🔧 PASO 1: Normalización principal
      const normalized = PhoneNumberService.normalizeUnified(testCase);
      
      // 🔧 PASO 2: Generar variantes de búsqueda
      const searchVariants = PhoneNumberService.searchVariants(testCase);
      
      // 🔧 PASO 3: Verificar consistencia
      const isValid = PhoneNumberService.isValidArgentineNumber(testCase);
      
      // 🔧 PASO 4: Formato legible
      const readable = PhoneNumberService.toReadableFormat(testCase);
      
      // 🔧 PASO 5: Verificar resultado
      const expectedFormat = '+5491135562673';
      const isCorrect = normalized === expectedFormat;
      
      if (isCorrect) {
        passedTests++;
        console.log(`✅ ${testCase.padEnd(20)} → ${normalized} (${readable})`);
      } else {
        console.log(`❌ ${testCase.padEnd(20)} → ${normalized} (esperado: ${expectedFormat})`);
      }
      
      // 🔧 PASO 6: Verificar variantes de búsqueda
      if (searchVariants.includes(expectedFormat)) {
        console.log(`   🔍 Variantes incluyen formato esperado: ✅`);
      } else {
        console.log(`   🔍 Variantes NO incluyen formato esperado: ❌`);
        console.log(`   🔍 Variantes encontradas:`, searchVariants);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error probando caso ${testCase}:`, error);
      console.log('');
    }
  }

  // 🔧 RESUMEN DE PRUEBAS
  console.log('---');
  console.log('📊 RESUMEN DE PRUEBAS:');
  console.log(`✅ Pruebas exitosas: ${passedTests}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Tasa de éxito: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ¡Todas las pruebas pasaron exitosamente!');
    console.log('📱 La normalización unificada está funcionando correctamente.');
  } else {
    console.log('⚠️  Algunas pruebas fallaron. Revisar la implementación.');
  }

  // 🔧 PRUEBA DE EQUIVALENCIA
  console.log('');
  console.log('🔍 PRUEBA DE EQUIVALENCIA:');
  
  const testEquivalence = [
    ['+5491135562673', '+541135562673'],
    ['5491135562673', '1135562673'],
    ['+54 9 11 3556 2673', '54-9-11-3556-2673']
  ];

  for (const [phone1, phone2] of testEquivalence) {
    const areEquivalent = PhoneNumberService.areEquivalent(phone1, phone2);
    console.log(`${phone1.padEnd(20)} ≡ ${phone2.padEnd(20)} → ${areEquivalent ? '✅' : '❌'}`);
  }
}

// 🔧 EJECUTAR PRUEBAS
if (require.main === module) {
  testPhoneNormalization()
    .then(() => {
      console.log('✅ Script de pruebas completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en script de pruebas:', error);
      process.exit(1);
    });
}

export { testPhoneNormalization };
