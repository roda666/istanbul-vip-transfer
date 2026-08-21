/** Shared, side-effect-free OpenAI model selection for server jobs and tests. */
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

function configuredModel(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** New global override, then the legacy content setting, then translation. */
export function getOpenAiContentModel(): string {
  return configuredModel('OPENAI_MODEL', 'OPENAI_CONTENT_MODEL', 'OPENAI_TRANSLATION_MODEL')
    ?? DEFAULT_OPENAI_MODEL;
}

/** New global override, then the legacy translation setting, then content. */
export function getOpenAiTranslationModel(): string {
  return configuredModel('OPENAI_MODEL', 'OPENAI_TRANSLATION_MODEL', 'OPENAI_CONTENT_MODEL')
    ?? DEFAULT_OPENAI_MODEL;
}

/** Backwards-compatible general model selection for status/display callers. */
export function getOpenAiModel(): string {
  return getOpenAiContentModel();
}