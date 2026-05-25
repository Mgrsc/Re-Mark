import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { getSettings } from '../utils/storage';
import { getBookmarkTree, flattenBookmarks, flattenBookmarkTreeForSearch, buildBookmarkTree, clearAllBookmarks, countBookmarks, countBookmarkTree } from '../utils/bookmarks';
import { buildBookmarkFingerprint } from '../utils/bookmarkFingerprint';
import { fetchGist, updateGist } from '../utils/gist';
import { getChangeState, getUploadSkipState, type UploadSource } from '../utils/syncState';
import { canonicalizeBookmarkUrl } from '../utils/canonicalUrl';
import { enrichBookmarkWithAI, fetchJinaContent, getRetryDelayMs, isRetryableEnrichmentError } from '../utils/enrich';
import {
  createEnrichJob,
  failEnrichJobStep,
  finishEnrichJobStep,
  getNextEnrichStepDelayMs,
  resolveEnrichJobStepContinuation,
  startEnrichJobStep,
  stopEnrichJob,
  type EnrichJobState
} from '../utils/enrichJob';
import { getEnrichmentMode, type EnrichmentMode } from '../utils/enrichmentMode';
import { hasServicePermissions } from '../utils/servicePermissions';
import { shouldApplyGeneratedTitle } from '../utils/titleCleaner';
import type { BookmarkItem, Settings, SyncData } from '../types';

type Locale = 'en' | 'zh';

const locales: Record<
  Locale,
  {
    missingToken: string;
    missingTokenAndGist: string;
    missingAiSettings: string;
    invalidWebUrl: string;
    permissionDenied: string;
    remoteConflictTitle: string;
    remoteConflictMessage: string;
    gistCreatedTitle: string;
    gistCreatedMessage: (gistId: string) => string;
    uploadSuccessTitle: string;
    uploadSuccessMessage: (count: number) => string;
    noChangesTitle: string;
    noChangesMessage: string;
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
    enrichStoppedByUserTitle: string;
    enrichStoppedByUserMessage: string;
  }
> = {
  en: {
    missingToken: 'Please configure GitHub Token in settings',
    missingTokenAndGist: 'Please configure GitHub Token and Gist ID',
    missingAiSettings: 'Please configure AI settings',
    invalidWebUrl: 'Invalid service URL',
    permissionDenied: 'Permission denied for the configured service URL',
    remoteConflictTitle: 'Remote Updated',
    remoteConflictMessage: 'Remote data changed since your last sync. Please refresh/download first, or confirm overwrite.',
    gistCreatedTitle: 'Gist Created',
    gistCreatedMessage: gistId => `Auto-created Gist: ${gistId}`,
    uploadSuccessTitle: 'Upload Success',
    uploadSuccessMessage: count => `Uploaded ${count} bookmarks`,
    noChangesTitle: 'No Changes',
    noChangesMessage: 'Local bookmarks are unchanged. Nothing was uploaded.',
    downloadSuccessTitle: 'Download Success',
    downloadSuccessMessage: count => `Restored ${count} bookmarks`,
    noBookmarksInGist: 'No bookmarks found in Gist',
    clearSuccessTitle: 'Clear Success',
    clearSuccessMessage: 'All bookmarks cleared',
    refreshFailedTitle: 'Refresh Failed',
    enrichStartedTitle: 'Processing Started',
    enrichStartedMessage: 'Processing bookmarks in batches',
    enrichCompletedTitle: 'Processing Completed',
    enrichCompletedMessage: 'All eligible bookmarks processed',
    enrichStoppedTitle: 'Processing Stopped',
    enrichStoppedMessage: (processed, remaining) => `Processed ${processed}, remaining ${remaining} (retryable)`,
    enrichFailedTitle: 'Enrich Failed',
    enrichStoppedByUserTitle: 'Processing Stopped',
    enrichStoppedByUserMessage: 'Bookmark processing was stopped'
  },
  zh: {
    missingToken: '请在设置中配置 GitHub Token',
    missingTokenAndGist: '请配置 GitHub Token 和 Gist ID',
    missingAiSettings: '请配置 AI 设置',
    invalidWebUrl: '请输入有效的服务 URL',
    permissionDenied: '未获得所填服务 URL 的站点权限',
    remoteConflictTitle: '远端已更新',
    remoteConflictMessage: '检测到远端数据在你上次同步后发生变化。请先刷新/下载，或确认覆盖远端。',
    gistCreatedTitle: '已创建 Gist',
    gistCreatedMessage: gistId => `已自动创建 Gist：${gistId}`,
    uploadSuccessTitle: '上传成功',
    uploadSuccessMessage: count => `已上传 ${count} 个书签`,
    noChangesTitle: '没有改动',
    noChangesMessage: '本地书签没有变化，未执行上传。',
    downloadSuccessTitle: '下载成功',
    downloadSuccessMessage: count => `已恢复 ${count} 个书签`,
    noBookmarksInGist: 'Gist 中没有书签数据',
    clearSuccessTitle: '清空成功',
    clearSuccessMessage: '已清空所有书签',
    refreshFailedTitle: '刷新失败',
    enrichStartedTitle: '开始处理',
    enrichStartedMessage: '正在分批处理书签',
    enrichCompletedTitle: '处理完成',
    enrichCompletedMessage: '所有可处理书签已完成',
    enrichStoppedTitle: '处理已暂停',
    enrichStoppedMessage: (processed, remaining) => `已处理 ${processed}，剩余 ${remaining}（可重试）`,
    enrichFailedTitle: '富化失败',
    enrichStoppedByUserTitle: '处理已停止',
    enrichStoppedByUserMessage: '已停止书签处理'
  }
};

const getLocale = (): Locale => (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en');
const localeText = () => locales[getLocale()];

let isSyncing = false;
let isEnrichStepRunning = false;
let shouldRunEnrichStepAgain = false;
const SYNC_ALARM_NAME = 'auto-sync-bookmarks';
const ENRICH_ALARM_NAME = 'enrich-bookmarks-step';
const ENRICH_JOB_KEY = 'enrichJob';
const ENRICHMENT_RECORDS_KEY = 'enrichmentRecords';
const ENRICH_STEP_DELAY_MS = 30_000;
const MAX_ENRICH_NO_PROGRESS_STEPS = 3;
const MAX_ENRICH_ITEM_ATTEMPTS = 2;
const MAX_RETRYABLE_ENRICH_ITEM_ATTEMPTS = 5;

const notificationIcon = '/icon/128.png';
const BASE_REMOTE_UPDATED_AT_KEY = 'baseRemoteUpdatedAt';
const REMOTE_UPDATED_AT_KEY = 'remoteUpdatedAt';
const BASE_LOCAL_FINGERPRINT_KEY = 'baseLocalFingerprint';

interface EnrichmentRecord {
  canonicalUrl: string;
  sourceTitle: string;
  cleanedTitle?: string;
  summary?: string;
  tags?: string[];
  cover?: string | boolean;
  titleCleanedAt?: number;
  enrichedAt?: number;
  attempts?: number;
  nextRetryAt?: number;
  lastError?: string;
}

type EnrichmentRecords = Record<string, EnrichmentRecord>;

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
  browser.runtime.onInstalled.addListener(() => {
    updateLocalCount().catch(() => {});
    resumeEnrichJobIfNeeded().catch(() => {});
  });
  browser.runtime.onStartup.addListener(() => {
    resumeEnrichJobIfNeeded().catch(() => {});
  });

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const actions: Record<string, () => Promise<void>> = {
      upload: () => handleUpload(!!msg.force, 'manual'),
      download: handleDownload,
      clear: handleClear,
      enrich: handleEnrich,
      stopEnrich: handleStopEnrich,
      refresh: handleRefresh
    };

    const action = actions[msg.action];
    if (action) {
      action()
        .then(() => sendResponse({ success: true }))
        .catch(err => {
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

  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === SYNC_ALARM_NAME) {
      handleUpload(false, 'auto').catch(() => {});
    }
    if (alarm.name === ENRICH_ALARM_NAME) {
      runEnrichJobStep().catch(() => {});
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

async function handleUpload(force = false, source: UploadSource = 'manual') {
  const locale = localeText();
  const settings = await getSettings();

  if (!settings.githubToken) throw new Error(locale.missingToken);

  isSyncing = true;
  browser.action.setBadgeText({ text: '...' });
  browser.action.setBadgeBackgroundColor({ color: '#3b82f6' });

  let finalBadge: { text: string; color: string } | null = null;

  try {
    const tree = await getBookmarkTree();
    const items = await flattenBookmarks(tree);
    const localFingerprint = await buildBookmarkFingerprint(items);
    const { [BASE_LOCAL_FINGERPRINT_KEY]: baseLocalFingerprint } = await browser.storage.local.get([BASE_LOCAL_FINGERPRINT_KEY]);
    const changeState = getChangeState(baseLocalFingerprint, localFingerprint);
    const skipState = getUploadSkipState(changeState, source);

    if (skipState.skipUpload) {
      if (skipState.notifyNoChanges) await showNotification(locale.noChangesTitle, locale.noChangesMessage);
      return;
    }

    let gistId = settings.gistId;

    if (!gistId) {
      const { createGist } = await import('../utils/gist');
      gistId = await createGist(settings.githubToken);
      await browser.storage.local.set({ gistId });
      await showNotification(locale.gistCreatedTitle, locale.gistCreatedMessage(gistId));
    }

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
      const aiByCanonicalUrlMap = new Map<string, any>();

      existingData.items.forEach(item => {
        if (item.ai) {
          aiByIdMap.set(item.id, item.ai);
          if (item.url) {
            aiByUrlMap.set(item.url, item.ai);
            aiByCanonicalUrlMap.set(canonicalizeBookmarkUrl(item.url), item.ai);
          }
        }
      });

      items.forEach(item => {
        const ai = aiByIdMap.get(item.id) || (item.url ? aiByUrlMap.get(item.url) || aiByCanonicalUrlMap.get(canonicalizeBookmarkUrl(item.url)) : undefined);
        if (ai) item.ai = ai;
      });
    }

    const syncData: SyncData = {
      version: '2.5',
      updatedAt: Date.now(),
      browser: navigator.userAgent,
      items: items
    };

    await updateGist(settings.githubToken, gistId, syncData);

    const count = countBookmarks(syncData.items);
    await browser.storage.local.set({
      remoteCount: count,
      [REMOTE_UPDATED_AT_KEY]: syncData.updatedAt,
      [BASE_REMOTE_UPDATED_AT_KEY]: syncData.updatedAt,
      [BASE_LOCAL_FINGERPRINT_KEY]: localFingerprint
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
    const localTree = await getBookmarkTree();
    const localItems = await flattenBookmarks(localTree);
    const localFingerprint = await buildBookmarkFingerprint(localItems);
    await browser.storage.local.set({
      remoteCount: count,
      [REMOTE_UPDATED_AT_KEY]: data.updatedAt,
      [BASE_REMOTE_UPDATED_AT_KEY]: data.updatedAt,
      [BASE_LOCAL_FINGERPRINT_KEY]: localFingerprint
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

  const changeState = await updateLocalCountAndGetChangeState();
  if (changeState === 'unchanged') {
    browser.action.setBadgeText({ text: '' });
    await browser.alarms.clear(SYNC_ALARM_NAME);
    return;
  }

  const settings = await getSettings();
  browser.action.setBadgeText({ text: '!' });
  browser.action.setBadgeBackgroundColor({ color: '#ef4444' });

  if (settings.autoSync) {
    await browser.alarms.clear(SYNC_ALARM_NAME);
    await browser.alarms.create(SYNC_ALARM_NAME, {
      delayInMinutes: settings.syncDelay
    });
  }
}

async function updateLocalCountAndGetChangeState() {
  const tree = await getBookmarkTree();
  const count = countBookmarkTree(tree);
  await browser.storage.local.set({ localCount: count });
  const items = await flattenBookmarks(tree);
  const localFingerprint = await buildBookmarkFingerprint(items);
  const { [BASE_LOCAL_FINGERPRINT_KEY]: baseLocalFingerprint } = await browser.storage.local.get([BASE_LOCAL_FINGERPRINT_KEY]);
  return getChangeState(baseLocalFingerprint, localFingerprint);
}

async function handleEnrich() {
  const locale = localeText();
  const settings = await getSettings();
  const mode = getEnrichmentMode(settings);

  if (mode === 'hidden') throw new Error(locale.missingAiSettings);
  if (!(await hasServicePermissions(settings, mode))) throw new Error(locale.permissionDenied);

  const existingJob = await getEnrichJob();
  const now = Date.now();
  const nextJob = existingJob && (existingJob.state === 'running' || existingJob.state === 'paused')
    ? startEnrichJobStep(existingJob, now)
    : createEnrichJob(now);

  await setEnrichJob(nextJob);
  await browser.alarms.clear(ENRICH_ALARM_NAME);
  await scheduleNextEnrichStep(0);
  await showNotification(locale.enrichStartedTitle, locale.enrichStartedMessage);
}

async function handleStopEnrich() {
  const locale = localeText();
  const job = await getEnrichJob();
  if (!job) return;

  const stoppedJob = stopEnrichJob(job, Date.now());
  await setEnrichJob(stoppedJob);
  await browser.alarms.clear(ENRICH_ALARM_NAME);
  await showNotification(locale.enrichStoppedByUserTitle, locale.enrichStoppedByUserMessage);
}

async function runEnrichJobStep() {
  if (isEnrichStepRunning) {
    shouldRunEnrichStepAgain = true;
    return;
  }
  isEnrichStepRunning = true;

  try {
    await runEnrichJobStepUnsafe();
  } finally {
    isEnrichStepRunning = false;
    if (shouldRunEnrichStepAgain) {
      shouldRunEnrichStepAgain = false;
      runEnrichJobStep().catch(() => {});
    }
  }
}

async function runEnrichJobStepUnsafe() {
  const locale = localeText();
  const job = await getEnrichJob();
  if (!job || (job.state !== 'running' && job.state !== 'paused')) return;

  const settings = await getSettings();
  const mode = getEnrichmentMode(settings);
  if (mode === 'hidden') {
    const failedJob: EnrichJobState = {
      ...job,
      state: 'failed',
      updatedAt: Date.now(),
      nextRunAt: undefined,
      lastError: locale.missingAiSettings
    };
    await setEnrichJob(failedJob);
    await showNotification(locale.enrichFailedTitle, failedJob.lastError ?? locale.enrichFailedTitle);
    return;
  }

  const startedJob = startEnrichJobStep(job, Date.now());
  await setEnrichJob(startedJob);

  try {
    const result = await runLocalEnrichStep(settings, mode);
    const currentJob = await getEnrichJob();
    const continuation = resolveEnrichJobStepContinuation(startedJob, currentJob);
    if (continuation === 'stop') {
      await browser.alarms.clear(ENRICH_ALARM_NAME);
      return;
    }

    if (continuation === 'restart') {
      await scheduleNextEnrichStep(0);
      return;
    }

    const nextDelayMs = getNextEnrichStepDelayMs(result, ENRICH_STEP_DELAY_MS);
    const nextJob = finishEnrichJobStep(currentJob ?? startedJob, result, Date.now(), nextDelayMs ?? 0);
    await setEnrichJob(nextJob);

    if (nextJob.state === 'completed') {
      await browser.alarms.clear(ENRICH_ALARM_NAME);
      await showNotification(locale.enrichCompletedTitle, locale.enrichCompletedMessage);
      return;
    }

    if ((nextJob.noProgressSteps ?? 0) >= MAX_ENRICH_NO_PROGRESS_STEPS) {
      const stoppedJob: EnrichJobState = {
        ...nextJob,
        state: 'paused',
        nextRunAt: undefined
      };
      await setEnrichJob(stoppedJob);
      await browser.alarms.clear(ENRICH_ALARM_NAME);
      await showNotification(locale.enrichStoppedTitle, locale.enrichStoppedMessage(stoppedJob.processed, stoppedJob.remaining));
      return;
    }

    if (nextDelayMs !== undefined) {
      await scheduleNextEnrichStep(nextDelayMs);
      return;
    }

    const stoppedJob: EnrichJobState = {
      ...nextJob,
      state: 'paused',
      nextRunAt: undefined
    };
    await setEnrichJob(stoppedJob);
    await browser.alarms.clear(ENRICH_ALARM_NAME);
    await showNotification(locale.enrichStoppedTitle, locale.enrichStoppedMessage(stoppedJob.processed, stoppedJob.remaining));
  } catch (err) {
    const continuation = resolveEnrichJobStepContinuation(startedJob, await getEnrichJob());
    if (continuation === 'stop') {
      await browser.alarms.clear(ENRICH_ALARM_NAME);
      return;
    }

    if (continuation === 'restart') {
      await scheduleNextEnrichStep(0);
      return;
    }

    const failedJob = failEnrichJobStep(startedJob, err instanceof Error ? err.message : String(err), Date.now());
    await setEnrichJob(failedJob);
    await scheduleNextEnrichStep(Math.max(0, (failedJob.nextRunAt ?? Date.now()) - Date.now()));
  }
}

async function getEnrichJob(): Promise<EnrichJobState | null> {
  const data = await browser.storage.local.get([ENRICH_JOB_KEY]);
  return (data[ENRICH_JOB_KEY] as EnrichJobState | undefined) ?? null;
}

async function setEnrichJob(job: EnrichJobState) {
  await browser.storage.local.set({ [ENRICH_JOB_KEY]: job });
}

async function scheduleNextEnrichStep(delayMs: number) {
  if (delayMs <= 0) {
    if (isEnrichStepRunning) {
      shouldRunEnrichStepAgain = true;
      return;
    }

    runEnrichJobStep().catch(() => {});
    return;
  }

  await browser.alarms.create(ENRICH_ALARM_NAME, {
    delayInMinutes: Math.max(delayMs / 60_000, 0.5)
  });
}

async function resumeEnrichJobIfNeeded() {
  const job = await getEnrichJob();
  if (!job || (job.state !== 'running' && job.state !== 'paused')) return;

  await scheduleNextEnrichStep(Math.max(0, (job.nextRunAt ?? Date.now()) - Date.now()));
}

async function updateLocalCount() {
  const tree = await getBookmarkTree();
  const count = countBookmarkTree(tree);
  await browser.storage.local.set({ localCount: count });
}

async function runLocalEnrichStep(settings: Settings, mode: EnrichmentMode) {
  const tree = await getBookmarkTree();
  const items = flattenBookmarkTreeForSearch(tree).filter((item): item is BookmarkItem & { url: string } => !!item.url);
  const records = await getEnrichmentRecords();
  const now = Date.now();
  const pendingItems = items.filter(item => shouldProcessBookmark(item, records, mode, now, false));
  const deferredCount = items.filter(item => shouldProcessBookmark(item, records, mode, now, true)).length;

  if (pendingItems.length === 0) {
    return {
      processed: 0,
      remaining: deferredCount,
      readyRemaining: 0,
      completed: deferredCount === 0,
      timedOut: false,
      retryDelayMs: getEarliestRetryDelayMs(records)
    };
  }

  const concurrency = normalizeEnrichmentConcurrency(settings.enrichmentConcurrency);
  const batch = pendingItems.slice(0, concurrency);
  isSyncing = true;

  try {
    const results = await Promise.all(batch.map(item => processEnrichmentItem(item, settings, mode, records)));
    results.forEach(result => {
      records[result.canonicalUrl] = result.record;
    });
  } finally {
    isSyncing = false;
  }

  await setEnrichmentRecords(records);
  await syncEnrichmentRecordsToGist(settings, records);

  const nextTree = await getBookmarkTree();
  const nextItems = flattenBookmarkTreeForSearch(nextTree).filter((item): item is BookmarkItem & { url: string } => !!item.url);
  const nextNow = Date.now();
  const readyRemaining = nextItems.filter(item => shouldProcessBookmark(item, records, mode, nextNow, false)).length;
  const remaining = nextItems.filter(item => shouldProcessBookmark(item, records, mode, nextNow, true)).length;
  const processed = batch.length;

  await updateLocalCount();
  return { processed, remaining, readyRemaining, completed: remaining === 0, timedOut: false, retryDelayMs: getEarliestRetryDelayMs(records) };
}

function shouldProcessBookmark(
  item: BookmarkItem & { url: string },
  records: EnrichmentRecords,
  mode: EnrichmentMode,
  now: number,
  includeDeferred: boolean
): boolean {
  const canonicalUrl = canonicalizeBookmarkUrl(item.url);
  const record = records[canonicalUrl];
  if (hasExceededEnrichmentAttempts(record)) return false;
  if (!includeDeferred && record?.nextRetryAt && record.nextRetryAt > now) return false;
  if (mode === 'smartEnrichment') return !(record?.enrichedAt && record.cleanedTitle === item.title);
  return record?.cleanedTitle !== item.title;
}

async function processEnrichmentItem(
  item: BookmarkItem & { url: string },
  settings: Settings,
  mode: EnrichmentMode,
  records: EnrichmentRecords
): Promise<{ canonicalUrl: string; record: EnrichmentRecord }> {
  const canonicalUrl = canonicalizeBookmarkUrl(item.url);
  const previous = records[canonicalUrl];
  const itemWithSettings = { ...item, titleLanguage: settings.titleLanguage };

  try {
    const content = mode === 'smartEnrichment' ? await fetchJinaContent(itemWithSettings.url, settings.jinaApiKey) : undefined;
    const result = await enrichBookmarkWithAI(itemWithSettings, settings, content);
    const now = Date.now();
    let cleanedTitle = item.title;

    if (shouldApplyGeneratedTitle(item.title, result.title)) {
      await browser.bookmarks.update(item.id, { title: result.title });
      cleanedTitle = result.title;
    }

    return {
      canonicalUrl,
      record: {
        canonicalUrl,
        sourceTitle: item.title,
        cleanedTitle,
        summary: result.summary || previous?.summary,
        tags: result.tags || previous?.tags,
        cover: result.cover || previous?.cover,
        titleCleanedAt: now,
        enrichedAt: mode === 'smartEnrichment' ? now : previous?.enrichedAt,
        attempts: 0,
        lastError: undefined,
        nextRetryAt: undefined
      }
    };
  } catch (err) {
    const attempts = (previous?.attempts ?? 0) + 1;
    const isRetryable = isRetryableEnrichmentError(err);
    return {
      canonicalUrl,
      record: {
        ...previous,
        canonicalUrl,
        sourceTitle: item.title,
        attempts,
        nextRetryAt: isRetryable ? Date.now() + getRetryDelayMs(attempts) : undefined,
        lastError: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

function normalizeEnrichmentConcurrency(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

function getEarliestRetryDelayMs(records: EnrichmentRecords): number | undefined {
  const now = Date.now();
  const retryTimes = Object.values(records)
    .filter(record => !hasExceededEnrichmentAttempts(record))
    .map(record => record.nextRetryAt)
    .filter((retryAt): retryAt is number => typeof retryAt === 'number' && retryAt > now);

  if (retryTimes.length === 0) return undefined;
  return Math.max(0, Math.min(...retryTimes) - now);
}

function hasExceededEnrichmentAttempts(record?: EnrichmentRecord): boolean {
  const maxAttempts = record?.nextRetryAt ? MAX_RETRYABLE_ENRICH_ITEM_ATTEMPTS : MAX_ENRICH_ITEM_ATTEMPTS;
  return (record?.attempts ?? 0) >= maxAttempts;
}

async function getEnrichmentRecords(): Promise<EnrichmentRecords> {
  const data = await browser.storage.local.get([ENRICHMENT_RECORDS_KEY]);
  return (data[ENRICHMENT_RECORDS_KEY] as EnrichmentRecords | undefined) ?? {};
}

async function setEnrichmentRecords(records: EnrichmentRecords) {
  await browser.storage.local.set({ [ENRICHMENT_RECORDS_KEY]: records });
}

async function syncEnrichmentRecordsToGist(settings: Settings, records: EnrichmentRecords) {
  if (!settings.githubToken) return;

  let gistId = settings.gistId;
  if (!gistId) {
    const { createGist } = await import('../utils/gist');
    gistId = await createGist(settings.githubToken);
    await browser.storage.local.set({ gistId });
  }

  const tree = await getBookmarkTree();
  const items = await flattenBookmarks(tree);
  const existingData = await fetchGist(settings.githubToken, gistId).catch(() => null);
  const existingAiByCanonicalUrl = new Map<string, BookmarkItem['ai']>();

  existingData?.items?.forEach(item => {
    if (item.url && item.ai) existingAiByCanonicalUrl.set(canonicalizeBookmarkUrl(item.url), item.ai);
  });

  items.forEach(item => {
    if (!item.url) return;
    const canonicalUrl = canonicalizeBookmarkUrl(item.url);
    const record = records[canonicalUrl];
    const existingAi = existingAiByCanonicalUrl.get(canonicalUrl);

    if (record?.enrichedAt && record.summary && record.tags) {
      item.ai = {
        title: record.cleanedTitle || item.title,
        summary: record.summary,
        tags: record.tags,
        cover: record.cover ?? false,
        enrichedAt: record.enrichedAt,
        canonicalUrl,
        sourceTitle: record.sourceTitle
      };
      return;
    }

    if (existingAi) item.ai = existingAi;
  });

  const syncData: SyncData = {
    version: '2.5',
    updatedAt: Date.now(),
    browser: navigator.userAgent,
    items
  };

  await updateGist(settings.githubToken, gistId, syncData);

  const localFingerprint = await buildBookmarkFingerprint(items);
  const count = countBookmarks(items);
  await browser.storage.local.set({
    remoteCount: count,
    [REMOTE_UPDATED_AT_KEY]: syncData.updatedAt,
    [BASE_REMOTE_UPDATED_AT_KEY]: syncData.updatedAt,
    [BASE_LOCAL_FINGERPRINT_KEY]: localFingerprint
  });
}
