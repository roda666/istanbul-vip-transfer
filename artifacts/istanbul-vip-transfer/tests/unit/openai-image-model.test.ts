import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENAI_IMAGE_MODEL,
  getOpenAiContentModel,
  getOpenAiImageModel,
} from '../../lib/ai/model-config-core';

const originalImageModel = process.env.OPENAI_IMAGE_MODEL;
const originalContentModel = process.env.OPENAI_CONTENT_MODEL;

afterEach(() => {
  if (originalImageModel === undefined) delete process.env.OPENAI_IMAGE_MODEL;
  else process.env.OPENAI_IMAGE_MODEL = originalImageModel;
  if (originalContentModel === undefined) delete process.env.OPENAI_CONTENT_MODEL;
  else process.env.OPENAI_CONTENT_MODEL = originalContentModel;
});

describe('OpenAI image model selection', () => {
  it('uses the GPT Image 2 default without changing content selection', () => {
    delete process.env.OPENAI_IMAGE_MODEL;
    process.env.OPENAI_CONTENT_MODEL = 'content-only-model';
    expect(getOpenAiImageModel()).toBe(DEFAULT_OPENAI_IMAGE_MODEL);
    expect(getOpenAiContentModel()).toBe('content-only-model');
  });

  it('uses only OPENAI_IMAGE_MODEL for images', () => {
    process.env.OPENAI_IMAGE_MODEL = 'custom-image-model';
    process.env.OPENAI_CONTENT_MODEL = 'content-only-model';
    expect(getOpenAiImageModel()).toBe('custom-image-model');
    expect(getOpenAiContentModel()).toBe('content-only-model');
  });
});