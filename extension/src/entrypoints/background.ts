import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { getSettings } from '../utils/storage';
import { getBookmarkTree, flattenBookmarks, buildBookmarkTree, clearAllBookmarks, countBookmarks } from '../utils/bookmarks';
import { fetchGist, updateGist } from '../utils/gist';
import type { SyncData } from '../types';

type Locale = 'en' | 'zh';

const locales: Record<Locale, {
  missingToken: string;
  missingTokenAndGist: string;
  missingWebSettings: string;
  invalidWebUrl: string;
  permissionDenied: string;
  remoteConflictTitle: string;
  remoteConflictMessage: string;
  gistCreatedTitle: string;
  gistCreatedMessage: (gistId: string) => string;
  uploadSuccessTitle: string;
  uploadSuccessMessage: (count: number) => string;
  downloadSuccessTitle: string;
  downloadSuccessMessage: (count: number) => string;
  noBookmarksInGist: string;
  clearSuccessTitle: string;
  clearSuccessMessage: string;
  refreshFailedTitle: string;
  enrichStartedTitle: string;
  enrichStartedMessage: string;
  enrichCompletedTitle: string;
  enrichCompletedMessage: string;
  enrichStoppedTitle: string;
  enrichStoppedMessage: (processed: number, remaining: number) => string;
  enrichFailedTitle: string;
}> = {
  en: {
    missingToken: 'Please configure GitHub Token in settings',
    missingTokenAndGist: 'Please configure GitHub Token and Gist ID',
    missingWebSettings: 'Please configure Web URL and API Secret',
    invalidWebUrl: 'Invalid Web URL',
    permissionDenied: 'Permission denied for the configured Web URL',
    remoteConflictTitle: 'Remote Updated',
    remoteConflictMessage: 'Remote data changed since your last sync. Please refresh/download first, or confirm overwrite.',
    gistCreatedTitle: 'Gist Created',
    gistCreatedMessage: gistId => `Auto-created Gist: ${gistId}`,
    uploadSuccessTitle: 'Upload Success',
    uploadSuccessMessage: count => `Uploaded ${count} bookmarks`,
    downloadSuccessTitle: 'Download Success',
    downloadSuccessMessage: count => `Restored ${count} bookmarks`,
    noBookmarksInGist: 'No bookmarks found in Gist',
    clearSuccessTitle: 'Clear Success',
    clearSuccessMessage: 'All bookmarks cleared',
    refreshFailedTitle: 'Refresh Failed',
    enrichStartedTitle: 'Enrich Started',
    enrichStartedMessage: 'Enriching... refresh later to see results',
    enrichCompletedTitle: 'Enrich Completed',
    enrichCompletedMessage: 'All bookmarks enriched',
    enrichStoppedTitle: 'Enrich Stopped',
    enrichStoppedMessage: (processed, remaining) => `Processed ${processed}, remaining ${remaining} (retryable)`,
    enrichFailedTitle: 'Enrich Failed'
  },
  zh: {
    missingToken: '请在设置中配置 GitHub Token',
    missingTokenAndGist: '请配置 GitHub Token 和 Gist ID',
    missingWebSettings: '请配置 Web URL 和 API Secret',
    invalidWebUrl: '请输入有效的 Web URL',
    permissionDenied: '未获得所填 Web URL 的站点权限',
    remoteConflictTitle: '远端已更新',
    remoteConflictMessage: '检测到远端数据在你上次同步后发生变化。请先刷新/下载，或确认覆盖远端。',
    gistCreatedTitle: '已创建 Gist',
    gistCreatedMessage: gistId => `已自动创建 Gist：${gistId}`,
    uploadSuccessTitle: '上传成功',
    uploadSuccessMessage: count => `已上传 ${count} 个书签`,
    downloadSuccessTitle: '下载成功',
    downloadSuccessMessage: count => `已恢复 ${count} 个书签`,
    noBookmarksInGist: 'Gist 中没有书签数据',
    clearSuccessTitle: '清空成功',
    clearSuccessMessage: '已清空所有书签',
    refreshFailedTitle: '刷新失败',
    enrichStartedTitle: '开始富化',
    enrichStartedMessage: '正在富化，稍后自动刷新即可查看结果',
    enrichCompletedTitle: '富化完成',
    enrichCompletedMessage: '所有书签已富化',
    enrichStoppedTitle: '富化已暂停',
    enrichStoppedMessage: (processed, remaining) => `已处理 ${processed}，剩余 ${remaining}（可重试）`,
    enrichFailedTitle: '富化失败'
  }
};

const getLocale = (): Locale => navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
const localeText = () => locales[getLocale()];

let isSyncing = false;
const SYNC_ALARM_NAME = 'auto-sync-bookmarks';

const notificationIcon = '/icon/128.png';
const BASE_REMOTE_UPDATED_AT_KEY = 'baseRemoteUpdatedAt';
const REMOTE_UPDATED_AT_KEY = 'remoteUpdatedAt';

const showNotification = async (title: string, message: string) => {
  if (!title?.trim() || !message?.trim()) return;

  try {
    await browser.notifications.create({
      type: 'basic' as const,
      iconUrl: notificationIcon,
      title: title.trim(),
      message: message.trim()
    });
  } catch {}
};

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(updateLocalCount);

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const actions: Record<string, () => Promise<void>> = {
      upload: () => handleUpload(!!msg.force, 'manual'),
      download: handleDownload,
      clear: handleClear,
      enrich: handleEnrich,
      refresh: handleRefresh
    };

    const action = actions[msg.action];
    if (action) {
      action()
        .then(() => sendResponse({ success: true }))
        .catch((err) => {
          const e = err as any;
          sendResponse({
            success: false,
            error: e?.message ?? String(err),
            code: e?.code,
            details: e?.details
          });
        });
      return true;
    }
  });

  browser.bookmarks.onCreated.addListener(handleBookmarkChange);
  browser.bookmarks.onRemoved.addListener(handleBookmarkChange);
  browser.bookmarks.onChanged.addListener(handleBookmarkChange);
  browser.bookmarks.onMoved.addListener(handleBookmarkChange);

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM_NAME) {
      handleUpload(false, 'auto').catch(() => {});
    }
  });
});

class RemoteConflictError extends Error {
  code = 'REMOTE_CONFLICT';
  details: { remoteUpdatedAt: number; remoteCount: number };

  constructor(message: string, details: { remoteUpdatedAt: number; remoteCount: number }) {
    super(message);
    this.details = details;
  }
}

async function handleUpload(force = false, source: 'manual' | 'auto' = 'manual') {
  const locale = localeText();
  const settings = await getSettings();

  if (!settings.githubToken) throw new Error(locale.missingToken);

  isSyncing = true;
  browser.action.setBadgeText({ text: '...' });
  browser.action.setBadgeBackgroundColor({ color: '#3b82f6' });

  let finalBadge: { text: string; color: string } | null = null;

  try {
    let gistId = settings.gistId;

    if (!gistId) {
      const { createGist } = await import('../utils/gist');
      gistId = await createGist(settings.githubToken);
      await browser.storage.local.set({ gistId });
      await showNotification(locale.gistCreatedTitle, locale.gistCreatedMessage(gistId));
    }

    const tree = await getBookmarkTree();
    const items = await flattenBookmarks(tree);
    const existingData = await fetchGist(settings.githubToken, gistId).catch(() => null);

    if (existingData?.updatedAt) {
      const remoteCount = countBookmarks(existingData.items ?? []);
      await browser.storage.local.set({
        remoteCount,
        [REMOTE_UPDATED_AT_KEY]: existingData.updatedAt
      });

      const { [BASE_REMOTE_UPDATED_AT_KEY]: baseRemoteUpdatedAt } = await browser.storage.local.get([BASE_REMOTE_UPDATED_AT_KEY]);
      const hasBase = typeof baseRemoteUpdatedAt === 'number';
      const hasRemoteBookmarks = remoteCount > 0;
      const remoteChanged = hasBase ? baseRemoteUpdatedAt !== existingData.updatedAt : hasRemoteBookmarks;

      if (!force && remoteChanged) {
        finalBadge = { text: '↻', color: '#f59e0b' };
        throw new RemoteConflictError(locale.remoteConflictMessage, {
          remoteUpdatedAt: existingData.updatedAt,
          remoteCount
        });
      }
    }

    if (existingData?.items) {
      const aiByIdMap = new Map<string, any>();
      const aiByUrlMap = new Map<string, any>();

      existingData.items.forEach(item => {
        if (item.ai) {
          aiByIdMap.set(item.id, item.ai);
          if (item.url) aiByUrlMap.set(item.url, item.ai);
        }
      });

      items.forEach(item => {
        const ai = aiByIdMap.get(item.id) || (item.url ? aiByUrlMap.get(item.url) : undefined);
        if (ai) item.ai = ai;
      });
    }

    const syncData: SyncData = {
      version: '1.0.0',
      updatedAt: Date.now(),
      browser: navigator.userAgent,
      items: items
    };

    await updateGist(settings.githubToken, gistId, syncData);

    const count = countBookmarks(syncData.items);
    await browser.storage.local.set({
      remoteCount: count,
      [REMOTE_UPDATED_AT_KEY]: syncData.updatedAt,
      [BASE_REMOTE_UPDATED_AT_KEY]: syncData.updatedAt
    });
    await showNotification(locale.uploadSuccessTitle, locale.uploadSuccessMessage(count));
  } finally {
    isSyncing = false;
    if (finalBadge) {
      browser.action.setBadgeText({ text: finalBadge.text });
      browser.action.setBadgeBackgroundColor({ color: finalBadge.color });
    } else {
      browser.action.setBadgeText({ text: '' });
    }
    await updateLocalCount();
  }
}

async function handleDownload() {
  const locale = localeText();
  const settings = await getSettings();

  if (!settings.githubToken || !settings.gistId) throw new Error(locale.missingTokenAndGist);

  isSyncing = true;
  browser.action.setBadgeText({ text: '...' });
  browser.action.setBadgeBackgroundColor({ color: '#3b82f6' });

  try {
    const data = await fetchGist(settings.githubToken, settings.gistId);
    if (!data?.items.length) throw new Error(locale.noBookmarksInGist);

    await clearAllBookmarks();
    await buildBookmarkTree(data.items);

    const count = countBookmarks(data.items);
    await browser.storage.local.set({
      remoteCount: count,
      [REMOTE_UPDATED_AT_KEY]: data.updatedAt,
      [BASE_REMOTE_UPDATED_AT_KEY]: data.updatedAt
    });
    await showNotification(locale.downloadSuccessTitle, locale.downloadSuccessMessage(count));
  } finally {
    isSyncing = false;
    browser.action.setBadgeText({ text: '' });
    await updateLocalCount();
  }
}

async function handleClear() {
  isSyncing = true;
  try {
    await clearAllBookmarks();
    await showNotification(localeText().clearSuccessTitle, localeText().clearSuccessMessage);
  } finally {
    isSyncing = false;
    await updateLocalCount();
  }
}

async function handleRefresh() {
  const locale = localeText();
  const settings = await getSettings();

  if (!settings.githubToken || !settings.gistId) throw new Error(locale.missingTokenAndGist);

  const data = await fetchGist(settings.githubToken, settings.gistId);
  if (!data) return;

  const count = countBookmarks(data.items ?? []);
  await browser.storage.local.set({
    remoteCount: count,
    [REMOTE_UPDATED_AT_KEY]: data.updatedAt
  });
}

async function handleBookmarkChange() {
  if (isSyncing) return;

  browser.action.setBadgeText({ text: '!' });
  browser.action.setBadgeBackgroundColor({ color: '#ef4444' });
  await updateLocalCount();

  const settings = await getSettings();
  if (settings.autoSync) {
    await browser.alarms.clear(SYNC_ALARM_NAME);
    await browser.alarms.create(SYNC_ALARM_NAME, {
      delayInMinutes: settings.syncDelay
    });
  }
}

async function handleEnrich() {
  const locale = localeText();
  const settings = await getSettings();

  if (!settings.githubToken || !settings.gistId) throw new Error(locale.missingTokenAndGist);
  if (!settings.webUrl || !settings.apiSecret) throw new Error(locale.missingWebSettings);

  await ensureHostPermission(settings.webUrl);
  await showNotification(locale.enrichStartedTitle, locale.enrichStartedMessage);

  try {
    const { runEnrichUntilDone } = await import('../utils/enrich');
    const result = await runEnrichUntilDone(settings.webUrl, settings.apiSecret);

    if (result.completed || result.remaining === 0) {
      await showNotification(locale.enrichCompletedTitle, locale.enrichCompletedMessage);
    } else {
      await showNotification(locale.enrichStoppedTitle, locale.enrichStoppedMessage(result.processed ?? 0, result.remaining ?? 0));
    }
  } catch (err) {
    await showNotification(locale.enrichFailedTitle, err instanceof Error ? err.message : String(err));
  }
}

async function updateLocalCount() {
  const tree = await getBookmarkTree();
  const items = await flattenBookmarks(tree);
  const count = countBookmarks(items);
  await browser.storage.local.set({ localCount: count });
}

async function ensureHostPermission(webUrl: string) {
  const locale = localeText();
  let origin: string;

  try {
    const url = new URL(webUrl);
    origin = `${url.origin}/*`;
  } catch {
    throw new Error(locale.invalidWebUrl);
  }

  const hasPermission = await browser.permissions.contains({ origins: [origin] });
  if (hasPermission) return;

  const granted = await browser.permissions.request({ origins: [origin] });
  if (!granted) throw new Error(locale.permissionDenied);
}
