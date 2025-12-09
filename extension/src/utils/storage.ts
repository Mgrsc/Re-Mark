import { browser } from 'wxt/browser';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  githubToken: '',
  gistId: '',
  apiSecret: '',
  webUrl: '',
  autoSync: false,
  syncDelay: 5
};

export async function getSettings(): Promise<Settings> {
  const localSettings = await browser.storage.local.get(DEFAULT_SETTINGS);
  const mergedLocal = { ...DEFAULT_SETTINGS, ...localSettings } as Settings;

  const needsMigration = !localSettings.githubToken && !localSettings.gistId && !localSettings.webUrl;
  if (needsMigration) {
    const syncSettings = await browser.storage.sync.get(DEFAULT_SETTINGS);
    const migrated = { ...mergedLocal, ...syncSettings } as Settings;
    await browser.storage.local.set(migrated);
    return migrated;
  }

  return mergedLocal;
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(settings);
}
