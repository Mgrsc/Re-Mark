import { describe, expect, it } from 'bun:test';
import {
  AI_COMPLETION_TIMEOUT_MS,
  JINA_CONTENT_TIMEOUT_MS,
  buildSmartEnrichmentPrompt,
  buildTitleCleanupPrompt,
  getRetryDelayMs,
  isRetryableEnrichmentError
} from './enrich';

describe('isRetryableEnrichmentError', () => {
  it('treats 429 errors as retryable', () => {
    expect(isRetryableEnrichmentError(new Error('AI API failed: 429 - Too Many Requests'))).toBe(true);
  });

  it('does not treat normal parse failures as retryable', () => {
    expect(isRetryableEnrichmentError(new Error('Unexpected token'))).toBe(false);
  });
});

describe('getRetryDelayMs', () => {
  it('uses bounded exponential backoff', () => {
    expect(getRetryDelayMs(1)).toBe(15_000);
    expect(getRetryDelayMs(2)).toBe(30_000);
    expect(getRetryDelayMs(20)).toBe(600_000);
  });
});

describe('request timeouts', () => {
  it('keeps individual fetch responses below the extension service worker limit', () => {
    expect(JINA_CONTENT_TIMEOUT_MS).toBeLessThan(30_000);
    expect(AI_COMPLETION_TIMEOUT_MS).toBeLessThan(30_000);
  });
});

describe('prompts', () => {
  it('requires a non-empty title for title cleanup', () => {
    const prompt = buildTitleCleanupPrompt({
      id: '1',
      title: 'Long marketing title',
      url: 'https://example.com',
      order: 0,
      createdAt: 1000
    });

    expect(prompt).toContain('title');
    expect(prompt).toContain('must be non-empty');
    expect(prompt).toContain('Never return {}, null, empty strings, or empty arrays.');
  });

  it('requests Chinese titles while preserving technical terms', () => {
    const prompt = buildTitleCleanupPrompt({
      id: '1',
      title: 'WebDAV backup guide',
      url: 'https://example.com/webdav',
      order: 0,
      createdAt: 1000,
      titleLanguage: 'zh-CN'
    });

    expect(prompt).toContain('Title language: Simplified Chinese.');
    expect(prompt).toContain('Preserve important original terms exactly');
    expect(prompt).toContain('WebDAV');
  });

  it('uses custom title language instructions', () => {
    const prompt = buildTitleCleanupPrompt({
      id: '1',
      title: '云存储教程',
      url: 'https://example.com/cloud-storage',
      order: 0,
      createdAt: 1000,
      titleLanguage: 'English'
    });

    expect(prompt).toContain('Title language: English.');
    expect(prompt).toContain('Preserve important original terms exactly');
  });

  it('falls back to auto when custom title language is blank', () => {
    const prompt = buildTitleCleanupPrompt({
      id: '1',
      title: 'WebDAV 备份',
      url: 'https://example.com/webdav',
      order: 0,
      createdAt: 1000,
      titleLanguage: '   '
    });

    expect(prompt).toContain('Title language: automatically match the dominant language');
  });

  it('requires complete non-empty fields for smart enrichment', () => {
    const prompt = buildSmartEnrichmentPrompt(
      {
        id: '1',
        title: 'Long marketing title',
        url: 'https://example.com',
        order: 0,
        createdAt: 1000
      },
      'Example page content'
    );

    expect(prompt).toContain('{"title":"...","summary":"...","tags":["..."]}');
    expect(prompt).toContain('All fields are required and must be non-empty.');
    expect(prompt).toContain('If page content is insufficient, infer from URL and current title.');
  });
});
