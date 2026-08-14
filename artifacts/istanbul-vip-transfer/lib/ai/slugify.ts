/**
 * Unicode-aware slug generator.
 * Works for Latin, Cyrillic (Russian), Arabic, and other scripts.
 * Strategy:
 *  1. Turkish char normalisation (ğ→g, ü→u, etc.)
 *  2. Cyrillic transliteration
 *  3. Arabic transliteration (simplified — vowels stripped, consonants mapped)
 *  4. Latin diacritic normalisation (NFD decompose + strip combining marks)
 *  5. Replace non-alphanumeric with hyphens
 *  6. Collapse / trim hyphens, truncate to 160 chars
 *  7. If slug is still empty after steps 1-6, fall back to a random hex suffix
 */

const TR: Record<string, string> = {
  ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ş: 's', Ş: 's',
  ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
};

// Cyrillic → Latin (Russian / common Slavic)
const CY: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
  А:'a',Б:'b',В:'v',Г:'g',Д:'d',Е:'e',Ё:'yo',Ж:'zh',З:'z',И:'i',Й:'j',
  К:'k',Л:'l',М:'m',Н:'n',О:'o',П:'p',Р:'r',С:'s',Т:'t',У:'u',Ф:'f',
  Х:'kh',Ц:'ts',Ч:'ch',Ш:'sh',Щ:'shch',Ъ:'',Ы:'y',Ь:'',Э:'e',Ю:'yu',Я:'ya',
};

// Arabic → Latin (simplified consonant map, vowels/diacritics stripped)
const AR: Record<string, string> = {
  ا:'a',ب:'b',ت:'t',ث:'th',ج:'j',ح:'h',خ:'kh',د:'d',ذ:'dh',ر:'r',ز:'z',
  س:'s',ش:'sh',ص:'s',ض:'d',ط:'t',ظ:'z',ع:'',غ:'gh',ف:'f',ق:'q',ك:'k',
  ل:'l',م:'m',ن:'n',ه:'h',و:'w',ي:'y',ى:'a',ة:'a',أ:'a',إ:'i',آ:'a',
  ء:'',ئ:'y',ؤ:'w',
};

export function slugify(input: string, fallbackPrefix = 'icerik'): string {
  if (!input || !input.trim()) return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;

  let s = input.trim().toLowerCase();

  // Turkish
  s = s.replace(/[ğüşıöçĞÜŞİÖÇ]/g, c => TR[c] ?? c);

  // Cyrillic
  s = s.replace(/[а-яёА-ЯЁ]/g, c => CY[c] ?? c);

  // Arabic (right-to-left, but string indices still work)
  s = s.replace(/[\u0600-\u06FF]/g, c => AR[c] ?? '');

  // Latin diacritics (é→e, ñ→n, etc.)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Keep only ASCII word chars and spaces
  s = s.replace(/[^a-z0-9\s-]/g, ' ');
  s = s.trim().replace(/[\s]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  s = s.slice(0, 160);

  if (!s) return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 8)}`;
  return s;
}
