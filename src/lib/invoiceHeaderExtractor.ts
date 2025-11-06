export interface Party {
  cuit?: string;
  razonSocial?: string;
  address?: string;
  role?: 'emisor' | 'receptor' | 'unknown';
}

const CUIT_REGEX = /(?:CUIT|C\.U\.I\.T\.|CUID|RUC)?\s*[:#-]?\s*(\d{2}[- .]?\d{8}[- .]?\d)/i;
const NAME_HINTS = /(raz[oó]n\s+social|nombre\s+legal|denominaci[oó]n|emisor|proveedor|vendedor|cliente|receptor)/i;
const ADDRESS_HINTS = /(domicilio|direcci[oó]n|direcci[oó]n\s+fiscal|localidad|provincia|cp|c\.p\.|código postal)/i;
// Excluir estas líneas que son labels, no nombres reales
// Labels y palabras comunes en facturas que NO son razón social
const EXCLUDE_LABELS = /^(apellido\s+y\s+nombre|apellido\s+y\s+nombre\s*\/\s*raz[oó]n\s+social|nombre\s+y\s+apellido|raz[oó]n\s+social\s*:?\s*$|denominaci[oó]n\s*:?\s*$)/i;
const EXCLUDE_WORDS = /^(ORIGINAL|DUPLICADO|TRIPLICADO|COPIA|FACTURA|NOTA|CREDITO|DEBITO|RECIBO|COMPROBANTE|A|B|C|PAGO|PENDIENTE)$/i;

function isValidCuit(cuitRaw?: string): boolean {
  if (!cuitRaw) return false;
  const digits = cuitRaw.replace(/[^0-9]/g, '');
  if (digits.length !== 11) return false;
  const nums = digits.split('').map(n => parseInt(n, 10));
  const weights = [5,4,3,2,7,6,5,4,3,2];
  const sum = weights.reduce((acc, w, i) => acc + w * nums[i], 0);
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : (mod === 10 ? 9 : mod);
  return check === nums[10];
}

export function extractHeader(text: string): { parties: Party[] } {
  console.log('🔍 [extractHeader] Iniciando extracción de header');
  console.log('📄 [extractHeader] Primeras 50 líneas del texto:', text.split(/\r?\n/).slice(0, 50).join('\n'));
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const parties: Party[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cuitMatch = line.match(CUIT_REGEX);
    if (cuitMatch) {
      const raw = cuitMatch[1].replace(/[ .-]/g, '');
      if (!isValidCuit(raw)) {
        console.log(`⚠️ [extractHeader] CUIT inválido encontrado: ${raw}`);
        continue;
      }
      const cuit = raw;
      console.log(`✅ [extractHeader] CUIT válido encontrado: ${cuit} en línea ${i}`);
      
      // Buscar razón social y dirección en líneas cercanas (ampliar búsqueda)
      // Nota: No buscamos "name" porque el usuario lo pondrá manualmente
      let razonSocial: string | undefined;
      let address: string | undefined;
      
      // Buscar en un rango más amplio (hasta 10 líneas antes y después)
      for (let j = Math.max(0, i - 10); j <= Math.min(lines.length - 1, i + 10); j++) {
        const l = lines[j];
        if (!l || l.length < 2) continue;
        
        // 0. Excluir líneas que son solo labels o palabras comunes de facturas (no nombres reales)
        if (EXCLUDE_LABELS.test(l)) {
          console.log(`⚠️ [extractHeader] Ignorando línea label: "${l}" en línea ${j}`);
          continue;
        }
        if (EXCLUDE_WORDS.test(l.trim())) {
          console.log(`⚠️ [extractHeader] Ignorando palabra común de factura: "${l.trim()}" en línea ${j}`);
          continue;
        }
        
        // 1. Buscar razón social con hints - PRIMERO en la misma línea, luego en la siguiente
        if (j !== i && NAME_HINTS.test(l) && !razonSocial) {
          console.log(`🔍 [extractHeader] Línea con hint de razón social encontrada: "${l}" (línea ${j})`);
          
          // PRIORIDAD 1: Extraer de la misma línea después del label (más común en facturas argentinas)
          // Ejemplos: 
          // - "Razón Social: PEREZ HILERO ARMANDO ENRIQUE"
          // - "Razón Social PEREZ HILERO ARMANDO ENRIQUE"
          // - "Razón Social:PEREZ HILERO ARMANDO ENRIQUE"
          const patterns = [
            /raz[oó]n\s+social\s*:?\s*(.+)/i,  // "Razón Social: VALOR" o "Razón Social VALOR"
            /(?:raz[oó]n\s+social|denominaci[oó]n)\s*:?\s*(.+)/i,  // Más flexible
          ];
          
          for (const pattern of patterns) {
            const sameLineMatch = l.match(pattern);
            if (sameLineMatch && sameLineMatch[1]) {
              let candidate = sameLineMatch[1].trim();
              // Limpiar posibles restos de labels o separadores
              candidate = candidate.replace(/^[:#\-]\s*/, '').trim();
              
              console.log(`🔍 [extractHeader] Candidato extraído: "${candidate}" (longitud: ${candidate.length})`);
              
              if (candidate && candidate.length > 2 && candidate.length < 150) {
                // Validaciones menos estrictas - solo verificar que no sea un label obvio
                const isExcludedLabel = EXCLUDE_LABELS.test(candidate);
                const isNameHint = NAME_HINTS.test(candidate);
                const isCuit = CUIT_REGEX.test(candidate);
                
                console.log(`🔍 [extractHeader] Validaciones: isExcludedLabel=${isExcludedLabel}, isNameHint=${isNameHint}, isCuit=${isCuit}`);
                
                if (!isExcludedLabel && !isNameHint && !isCuit) {
                  razonSocial = candidate;
                  console.log(`✅ [extractHeader] Razón social encontrada (misma línea del hint): "${razonSocial}" en línea ${j}`);
                  break;
                }
              }
            }
          }
          
          // Si aún no encontramos, intentar método alternativo: buscar después del label sin regex estricto
          if (!razonSocial) {
            const colonIndex = l.indexOf(':');
            if (colonIndex > 0 && NAME_HINTS.test(l.substring(0, colonIndex))) {
              let candidate = l.substring(colonIndex + 1).trim();
              if (candidate && candidate.length > 2 && candidate.length < 150 && 
                  !EXCLUDE_LABELS.test(candidate) && !CUIT_REGEX.test(candidate)) {
                razonSocial = candidate;
                console.log(`✅ [extractHeader] Razón social encontrada (método alternativo, misma línea): "${razonSocial}" en línea ${j}`);
                break;
              }
            }
          }
          
          // PRIORIDAD 2: Si no hay nada en la misma línea, buscar en la línea siguiente
          if (!razonSocial) {
            const nextLineIdx = j + 1;
            if (nextLineIdx < lines.length) {
              const nextLine = lines[nextLineIdx];
              console.log(`🔍 [extractHeader] Revisando línea siguiente: "${nextLine}" (línea ${nextLineIdx})`);
              if (nextLine && nextLine.length > 2 && nextLine.length < 150 && 
                  !EXCLUDE_LABELS.test(nextLine) &&
                  !NAME_HINTS.test(nextLine) &&
                  !ADDRESS_HINTS.test(nextLine) &&
                  !CUIT_REGEX.test(nextLine)) {
                razonSocial = nextLine.trim();
                console.log(`✅ [extractHeader] Razón social encontrada (línea siguiente al hint): "${razonSocial}" en línea ${nextLineIdx}`);
                break;
              }
            }
          }
        }
        
        // 2. Buscar líneas que parecen razón social (sin números grandes, mayúsculas o mixto)
        if (j !== i && !razonSocial && !EXCLUDE_LABELS.test(l)) {
          const trimmedLine = l.trim();
          
          // Excluir palabras comunes de facturas que no son razón social
          if (EXCLUDE_WORDS.test(trimmedLine)) {
            console.log(`⚠️ [extractHeader] Ignorando palabra común de factura: "${trimmedLine}" en línea ${j}`);
            continue;
          }
          
          // Línea en mayúsculas sin muchos números
          const isUpperCaseName = l === l.toUpperCase() && 
                                   l.length > 5 && 
                                   l.length < 80 && 
                                   !/\d{4,}/.test(l) &&
                                   !/^[0-9\s\-]+$/.test(l) &&
                                   !EXCLUDE_LABELS.test(l) &&
                                   !EXCLUDE_WORDS.test(trimmedLine);
          
          // Línea mixta (mayúsculas/minúsculas) que parece nombre
          const isMixedName = l.length > 5 && 
                             l.length < 80 &&
                             !/\d{3,}/.test(l) &&
                             !/^[0-9\s\-]+$/.test(l) &&
                             /[A-ZÁÉÍÓÚÑ]/.test(l) &&
                             !ADDRESS_HINTS.test(l) &&
                             !NAME_HINTS.test(l) &&
                             !EXCLUDE_LABELS.test(l) &&
                             !EXCLUDE_WORDS.test(trimmedLine);
          
          if (isUpperCaseName || isMixedName) {
            const candidate = trimmedLine;
            // Verificar que no sea una fecha, número, label o palabra común
            if (!/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(candidate) && 
                !EXCLUDE_LABELS.test(candidate) && 
                !EXCLUDE_WORDS.test(candidate)) {
              razonSocial = candidate;
              console.log(`✅ [extractHeader] Razón social inferida: "${razonSocial}" en línea ${j}`);
            }
          }
        }
        
        // 3. Buscar dirección - PRIMERO en la misma línea, luego en la siguiente
        if (j !== i && !address && ADDRESS_HINTS.test(l)) {
          // PRIORIDAD 1: Extraer de la misma línea después del label (más común en facturas argentinas)
          // Ejemplo: "Domicilio Comercial: Rodriguez Peña 99 Piso:local - Ciudad de Buenos Aires"
          const sameLineMatch = l.match(/(?:domicilio\s+comercial|domicilio|direcci[oó]n|direcci[oó]n\s+fiscal)\s*:?\s*(.+)/i);
          if (sameLineMatch && sameLineMatch[1]) {
            const candidate = sameLineMatch[1].trim();
            if (candidate && candidate.length > 5 && 
                !EXCLUDE_LABELS.test(candidate) &&
                !ADDRESS_HINTS.test(candidate) &&
                !NAME_HINTS.test(candidate) &&
                !CUIT_REGEX.test(candidate) &&
                // La dirección suele tener números (calle, número, etc.)
                (/\d/.test(candidate) || /calle|avenida|av\.|avda|boulevard|blvd|ruta/i.test(candidate))) {
              address = candidate;
              console.log(`✅ [extractHeader] Dirección encontrada (misma línea del hint): "${address}" en línea ${j}`);
              break;
            }
          }
          
          // PRIORIDAD 2: Si no hay nada en la misma línea, buscar en líneas siguientes
          for (let k = j + 1; k <= Math.min(lines.length - 1, j + 5); k++) {
            const nextLine = lines[k];
            if (nextLine && nextLine.length > 5 && 
                !NAME_HINTS.test(nextLine) && 
                !CUIT_REGEX.test(nextLine) &&
                !ADDRESS_HINTS.test(nextLine) &&
                !EXCLUDE_LABELS.test(nextLine) &&
                !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(nextLine) &&
                // La dirección suele tener números (calle, número, etc.)
                (/\d/.test(nextLine) || /calle|avenida|av\.|avda|boulevard|blvd|ruta/i.test(nextLine))) {
              address = nextLine.trim();
              console.log(`✅ [extractHeader] Dirección encontrada (línea siguiente al hint): "${address}" en línea ${k}`);
              break;
            }
          }
        }
      }
      
      // No usar name como razonSocial - el nombre lo pondrá el usuario
      
      // Si aún no hay razón social, intentar buscar en líneas anteriores al CUIT
      if (!razonSocial) {
        for (let j = Math.max(0, i - 5); j < i; j++) {
          const l = lines[j];
          if (l && l.length > 5 && l.length < 80 && 
              !/\d{4,}/.test(l) &&
              !/^[0-9\s\-]+$/.test(l) &&
              !CUIT_REGEX.test(l) &&
              !NAME_HINTS.test(l) &&
              !ADDRESS_HINTS.test(l) &&
              !EXCLUDE_LABELS.test(l)) {
            razonSocial = l.trim();
            console.log(`✅ [extractHeader] Razón social inferida (línea anterior): "${razonSocial}" en línea ${j}`);
            break;
          }
        }
      }
      
      console.log(`📊 [extractHeader] Datos extraídos para CUIT ${cuit}:`, {
        razonSocial,
        address,
        role: 'unknown'
      });
      
      parties.push({ cuit, razonSocial, address, role: 'unknown' });
    }
  }

  console.log(`📊 [extractHeader] Total de parties encontrados: ${parties.length}`);
  return { parties };
}

export function chooseSupplier(parties: Party[], userCuit?: string) {
  if (!parties.length) return undefined;
  // Si hay dos o más CUITs y uno coincide con el usuario, usar el otro
  if (userCuit) {
    const notUser = parties.find(p => p.cuit && p.cuit.replace(/[- .]/g,'') !== userCuit.replace(/[- .]/g,''));
    if (notUser) return notUser;
  }
  // En caso contrario, el primero detectado
  return parties[0];
}


