import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

type StorageValues = Record<string, unknown>;
type StorageGetInput = StorageValues | string[];

let localValues: StorageValues;
let syncValues: StorageValues;
const localSetCalls: StorageValues[] = [];

mock.module('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: async (input: StorageGetInput) => getStorageValues(input, localValues),
        set: async (values: StorageValues) => {
          localValues = { ...localValues, ...values };
          localSetCalls.push(values);
        }
      },
      sync: {
        get: async (input: StorageGetInput) => getStorageValues(input, syncValues)
      }
    }
  }
}));

function getStorageValues(input: StorageGetInput, values: StorageValues): StorageValues {
  if (Array.isArray(input)) {
    return Object.fromEntries(input.filter(key => key in values).map(key => [key, values[key]]));
  }

  return { ...input, ...values };
}

describe('getSettings', () => {
  beforeEach(() => {
    localValues = {};
    syncValues = {};
    localSetCalls.length = 0;
  });

  afterEach(() => {
    mock.restore();
  });

  it('uses neo-brutalist high contrast as the default theme', async () => {
    const { getSettings } = await import('./storage');

    await expect(getSettings()).resolves.toMatchObject({
      aiApiKey: '',
      aiApiUrl: 'https://api.deepseek.com/v1/chat/completions',
      aiModel: 'deepseek-chat',
      jinaApiKey: '',
      enableSmartEnrichment: false,
      enrichmentConcurrency: 10,
      titleLanguage: 'auto',
      theme: 'brutalist'
    });
  });

  it('preserves a saved theme from local storage', async () => {
    localValues = {
      githubToken: 'token',
      theme: 'terminal'
    };
    const { getSettings } = await import('./storage');

    await expect(getSettings()).resolves.toMatchObject({
      githubToken: 'token',
      theme: 'terminal'
    });
  });

  it('keeps a local theme when migrating legacy sync settings', async () => {
    localValues = {
      theme: 'glass'
    };
    syncValues = {
      githubToken: 'token-from-sync',
      theme: 'brutalist'
    };
    const { getSettings } = await import('./storage');

    await expect(getSettings()).resolves.toMatchObject({
      githubToken: 'token-from-sync',
      theme: 'glass'
    });
  });

  it('saves theme changes to local storage', async () => {
    const { saveSettings } = await import('./storage');

    await saveSettings({ theme: 'glass' });

    expect(localSetCalls).toEqual([{ theme: 'glass' }]);
  });
});
