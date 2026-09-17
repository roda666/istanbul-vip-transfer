/**
 * Runtime copy of the customer-copy toll guard.
 * Rules are deliberately selected by target locale; never scan a translation
 * with another language's vocabulary. Geography alone is allowed. A violation
 * is a direct toll term or geography + fee in the same sentence.
 */
type Rules = { direct: RegExp[]; geo: RegExp[]; fee: RegExp[] };

const token = (term: string, compound = false) => compound
  ? new RegExp(term, 'iu')
  : new RegExp(`(?<![\\p{L}\\p{N}_])${term}\\p{L}*(?![\\p{L}\\p{N}_])`, 'iu');

export const TOLL_FEE_RULES: Record<string, Rules> = {
  tr: {
    direct: [/geçiş\s*ücret\p{L}*/iu],
    geo: ['köprü', 'tünel', 'otoyol', 'feribot'].map(t => token(t)),
    fee: ['ücret', 'masraf', 'bedel', 'maliyet'].map(t => token(t))
      .concat([/(?<![\p{L}\p{N}_])gider(?!ken)\p{L}*(?![\p{L}\p{N}_])/iu]),
  },
  en: {
    direct: [/\btolls?\b/iu],
    geo: ['bridge', 'tunnel', 'highway', 'motorway', 'ferry'].map(t => token(t)),
    fee: [/\bfees?\b/iu, /\bcharg(?:e|es|ed)\b/iu, /\bcost(?:s|ly|ing)?\b/iu, /\bfares?\b/iu],
  },
  de: {
    direct: [token('maut', true)],
    geo: ['brücke', 'tunnel', 'autobahn', 'fähre'].map(t => token(t, true)),
    fee: [token('gebühr', true), /kosten(?!los)/iu],
  },
  ru: {
    direct: [/плата\s+за\s+проезд/iu, /дорожн\p{L}*\s+сбор\p{L}*/iu, /сбор\p{L}*\s+за\s+проезд/iu],
    geo: ['мост', 'туннел', 'тоннел', 'автомагистрал', 'паром'].map(t => token(t)),
    fee: [token('тариф'), /(?<![\p{L}\p{N}_])сбор(?!к|ник|ная|ной|очн)\p{L}*(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])плат(?!ье|ок|форм|о(?![\p{L}\p{N}_])|яно)\p{L}*(?![\p{L}\p{N}_])/iu],
  },
  fr: {
    direct: [token('péage')],
    geo: ['pont', 'tunnel', 'autoroute', 'ferry'].map(t => token(t)),
    fee: ['frais', 'coût', 'tarif'].map(t => token(t)),
  },
  es: {
    direct: [token('peaje')],
    geo: ['puente', 'túnel', 'autopista', 'ferry'].map(t => token(t)),
    fee: ['tarifa', 'costo'].map(t => token(t))
      .concat([/(?<![\p{L}\p{N}_])coste(?!r)\p{L}*(?![\p{L}\p{N}_])/iu,
        /(?<![\p{L}\p{N}_])cargo(?!dor)\p{L}*(?![\p{L}\p{N}_])/iu]),
  },
  it: {
    direct: [/\bpedaggi(?:o)?\b/iu],
    geo: [/(?<![\p{L}\p{N}_])ponte(?!fice)\p{L}*(?![\p{L}\p{N}_])/iu, ...['tunnel', 'autostrada', 'traghetto'].map(t => token(t))],
    fee: ['tariffa', 'spesa'].map(t => token(t))
      .concat([/(?<![\p{L}\p{N}_])costo(?!la)\p{L}*(?![\p{L}\p{N}_])/iu]),
  },
  nl: {
    direct: [/(?<![\p{L}\p{N}_])tol(?!k(?![\p{L}\p{N}_])|erant|ere|vrij)\p{L}*(?![\p{L}\p{N}_])/iu],
    geo: ['brug', 'tunnel', 'snelweg', 'veerboot'].map(t => token(t)),
    fee: ['kosten', 'tarief'].map(t => token(t)),
  },
  ar: {
    direct: [/رسوم\s+(?:العبور|الطريق|الطرق)/iu, /رسوم\s+المرور/iu],
    geo: [/جسو?ر/iu, /نفق|أنفاق/iu, /طريق\s+سريع|أوتوستراد/iu, /عبّ?ارة|معدية/iu],
    fee: [/(?<!م)رسوم/iu, /تكلفة/iu, /أجرة|أجور/iu],
  },
};

function sentences(text: string): string[] {
  return text.split(/\n/).flatMap(line => line.split(/(?<=[.!?؟])\s+/u))
    .map(value => value.trim()).filter(Boolean);
}

export function findTollFeeViolations(text: string | null | undefined, locale: string): string[] {
  const rules = TOLL_FEE_RULES[locale];
  if (!rules || !text) return [];
  const violations: string[] = [];
  for (const sentence of sentences(text)) {
    const direct = rules.direct.find(rule => rule.test(sentence));
    if (direct) {
      violations.push(`direct toll term: ${direct.source}`);
      continue;
    }
    const geo = rules.geo.some(rule => rule.test(sentence));
    const fee = rules.fee.some(rule => rule.test(sentence));
    if (geo && fee) violations.push('geography and fee in the same sentence');
  }
  return violations;
}