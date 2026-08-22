export type KnowledgeInput = {
  title: string;
  question: string | null;
  answer: string;
  category: string | null;
  language: string;
  isActive: boolean;
};

const MAX_TITLE = 180;
const MAX_QUESTION = 500;
const MAX_ANSWER = 4_000;
const MAX_CATEGORY = 80;

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function validLanguage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const language = value.trim().toLowerCase();
  return /^[a-z]{2,8}$/.test(language) ? language : null;
}

export function parseKnowledgeInput(
  input: unknown,
  partial = false,
): { value?: Partial<KnowledgeInput>; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Geçersiz kayıt verisi' };
  }
  const body = input as Record<string, unknown>;
  const updates: Partial<KnowledgeInput> = {};

  if (!partial || body.title !== undefined) {
    const title = optionalText(body.title, MAX_TITLE);
    if (!title) return { error: 'Başlık zorunludur' };
    updates.title = title;
  }

  if (!partial || body.answer !== undefined) {
    const answer = optionalText(body.answer, MAX_ANSWER);
    if (!answer) return { error: 'Yanıt zorunludur' };
    updates.answer = answer;
  }

  if (!partial || body.question !== undefined) {
    const question = optionalText(body.question, MAX_QUESTION);
    if (question === undefined) return { error: 'Soru metni geçersiz' };
    updates.question = question;
  }

  if (!partial || body.category !== undefined) {
    const category = optionalText(body.category, MAX_CATEGORY);
    if (category === undefined) return { error: 'Kategori geçersiz' };
    updates.category = category;
  }

  if (!partial || body.language !== undefined) {
    const language = validLanguage(body.language);
    if (!language) return { error: 'Dil kodu geçersiz' };
    updates.language = language;
  }

  if (!partial || body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return { error: 'Aktiflik değeri geçersiz' };
    updates.isActive = body.isActive;
  }

  if (partial && Object.keys(updates).length === 0) {
    return { error: 'Güncellenecek alan yok' };
  }
  return { value: updates };
}

export function parseTranslationLanguage(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return validLanguage((input as Record<string, unknown>).targetLanguage);
}