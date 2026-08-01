import { browser } from 'wxt/browser';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
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

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export async function getSettings(): Promise<Settings> {
  const localSettings = await browser.storage.local.get<Partial<Settings>>(SETTING_KEYS);
  const mergedLocal = { ...DEFAULT_SETTINGS, ...localSettings } as Settings;

  const needsMigration = !localSettings.githubToken && !localSettings.gistId && !localSettings.aiApiKey;
  if (needsMigration) {
    const syncSettings = await browser.storage.sync.get<Settings>(DEFAULT_SETTINGS);
    const migrated = { ...DEFAULT_SETTINGS, ...syncSettings, ...localSettings } as Settings;
    await browser.storage.local.set(migrated);
    return migrated;
  }

  return mergedLocal;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(settings);
}
