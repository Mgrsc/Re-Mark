import type { Settings } from '../types';

export type EnrichmentMode = 'hidden' | 'titleCleanup' | 'smartEnrichment';

export function getEnrichmentMode(settings: Settings): EnrichmentMode {
  if (!settings.aiApiKey.trim()) return 'hidden';
  if (settings.jinaApiKey.trim() && settings.enableSmartEnrichment) return 'smartEnrichment';
  return 'titleCleanup';
}
