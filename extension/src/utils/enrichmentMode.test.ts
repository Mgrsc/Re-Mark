import { describe, expect, it } from 'bun:test';
import type { Settings } from '../types';
import { getEnrichmentMode } from './enrichmentMode';

const baseSettings: Settings = {
  githubToken: '',
  gistId: '',
  aiApiKey: '',
  aiApiUrl: 'https://api.deepseek.com/v1/chat/completions',
  aiModel: 'deepseek-chat',
  jinaApiKey: '',
  enableSmartEnrichment: false,
  enrichmentConcurrency: 10,
  titleLanguage: 'auto',
  autoSync: false,
  syncDelay: 5,
  theme: 'brutalist'
};

describe('getEnrichmentMode', () => {
  it('hides the action without an AI API key', () => {
    expect(getEnrichmentMode(baseSettings)).toBe('hidden');
  });

  it('uses title cleanup when only AI is configured', () => {
    expect(getEnrichmentMode({ ...baseSettings, aiApiKey: 'sk-test' })).toBe('titleCleanup');
  });

  it('uses title cleanup when Jina exists but smart enrichment is disabled', () => {
    expect(getEnrichmentMode({ ...baseSettings, aiApiKey: 'sk-test', jinaApiKey: 'jina-test' })).toBe('titleCleanup');
  });

  it('uses smart enrichment when AI, Jina, and the enablement flag are configured', () => {
    expect(getEnrichmentMode({
      ...baseSettings,
      aiApiKey: 'sk-test',
      jinaApiKey: 'jina-test',
      enableSmartEnrichment: true
    })).toBe('smartEnrichment');
  });
});
