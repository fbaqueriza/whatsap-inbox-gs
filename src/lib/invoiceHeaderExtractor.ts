export interface Party {
  cuit?: string;
  name?: string;
  role?: 'emisor' | 'receptor' | 'unknown';
}

const CUIT_REGEX = /(?:CUIT|C\.U\.I\.T\.|CUID|RUC)?\s*[:#-]?\s*(\d{2}[- .]?\d{8}[- .]?\d)/i;
const NAME_HINTS = /(raz[oó]n\s+social|nombre\s+legal|emisor|proveedor|vendedor|cliente|receptor)/i;

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
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const parties: Party[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cuitMatch = line.match(CUIT_REGEX);
    if (cuitMatch) {
      const raw = cuitMatch[1].replace(/[ .-]/g, '');
      if (!isValidCuit(raw)) continue;
      const cuit = raw; // almacenar CUIT sin guiones
      // Buscar nombre en líneas cercanas
      let name: string | undefined;
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
        const l = lines[j];
        if (j !== i) {
          const m = l.match(NAME_HINTS);
          if (m) {
            // Nombre podría estar en la misma línea después del hint
            const nameCandidate = l.replace(NAME_HINTS, '').replace(/[:#]/g, '').trim();
            if (nameCandidate && nameCandidate.length > 2) { name = nameCandidate; break; }
          }
          // Si la línea parece un nombre en mayúsculas sin montos
          if (!/\d{3,}/.test(l) && l.length > 3 && l === l.toUpperCase()) {
            name = l.trim();
          }
        }
      }
      parties.push({ cuit, name, role: 'unknown' });
    }
  }

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


