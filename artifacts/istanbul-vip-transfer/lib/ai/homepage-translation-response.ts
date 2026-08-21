import { getOpenAiTranslationModel } from './model-config-core';

export type HomepageTranslationParseResult =
  | { ok: true; translated: Record<string, string>; model: string }
  | { ok: false; reason: 'rate_limited' | 'api_error' | 'parse_error'; message?: string };

/**
 * Accept only complete JSON responses. Falling back to Turkish source text
 * would allow a target-language page to be published with leaked source copy.
 */
export function parseHomepageTranslationResponse(
  fields: Record<string, string>,
  raw: string | null | undefined,
): HomepageTranslationParseResult {
  if (!raw?.trim()) {
    return { ok: false, reason: 'api_error', message: 'No content in OpenAI response' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'parse_error', message: 'Failed to parse JSON from AI response' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'parse_error', message: 'AI response is not an object' };
  }

  const result: Record<string, string> = {};
  for (const key of Object.keys(fields)) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value !== 'string') {
      return { ok: false, reason: 'parse_error', message: `AI response is missing a string value for ${key}` };
    }
    result[key] = value;
  }

  return { ok: true, translated: result, model: getOpenAiTranslationModel() };
}

export function classifyHomepageTranslationError(error: unknown): Extract<HomepageTranslationParseResult, { ok: false }> {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    return { ok: false, reason: 'rate_limited', message: 'OpenAI rate limit reached' };
  }
  return { ok: false, reason: 'api_error', message: 'OpenAI translation request failed' };
}