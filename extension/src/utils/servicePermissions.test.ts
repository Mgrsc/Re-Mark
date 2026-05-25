import { describe, expect, it } from 'bun:test';
import type { Settings } from '../types';
import { getServicePermissionOrigins } from './servicePermissions';

const settings: Settings = {
  githubToken: '',
  gistId: '',
  aiApiKey: 'sk-test',
  aiApiUrl: 'https://api.example.com/v1/chat/completions',
  aiModel: 'test-model',
  jinaApiKey: 'jina-test',
  enableSmartEnrichment: true,
  enrichmentConcurrency: 10,
  titleLanguage: 'auto',
  autoSync: false,
  syncDelay: 5,
  theme: 'brutalist'
};

describe('getServicePermissionOrigins', () => {
  it('includes only the AI endpoint origin for title cleanup', () => {
    expect(getServicePermissionOrigins(settings, 'titleCleanup')).toEqual(['https://api.example.com/*']);
  });

  it('includes Jina Reader for smart enrichment', () => {
    expect(getServicePermissionOrigins(settings, 'smartEnrichment')).toEqual([
      'https://api.example.com/*',
      'https://r.jina.ai/*'
    ]);
  });

  it('skips invalid AI endpoint URLs', () => {
    expect(getServicePermissionOrigins({ ...settings, aiApiUrl: 'not a url' }, 'titleCleanup')).toEqual([]);
  });
});
