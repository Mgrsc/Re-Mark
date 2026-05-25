import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import type { BookmarkItem, ThemeName } from '../../types';
import { flattenBookmarkTreeForSearch, getBookmarkTree, searchBookmarkItems } from '../../utils/bookmarks';
import type { EnrichJobState } from '../../utils/enrichJob';
import { getEnrichmentMode, type EnrichmentMode } from '../../utils/enrichmentMode';
import { getEnrichStatusText } from '../../utils/enrichStatus';
import { ensureServicePermissionsDuringUserGesture } from '../../utils/servicePermissions';
import { getSettings } from '../../utils/storage';
import './style.css';

const Icons = {
  Refresh: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
  ),
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  ),
  Download: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
  Enrich: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg>
  ),
  Trash: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  External: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
  ),
  Help: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  )
};

const locales = {
  en: {
    subtitle: 'Ordinary Advanced Bookmarks',
    bookmarkManager: 'Bookmark Manager',
    local: 'Local',
    remote: 'Remote',
    localTotal: 'Saved Total',
    remoteStorage: 'Remote Store',
    localTag: 'LOCAL',
    remoteTag: 'REMOTE',
    savedBookmarks: 'Saved bookmarks',
    syncedBookmarks: 'Synced bookmarks',
    saved: 'Saved',
    synced: 'Synced',
    uploadSlash: 'Upload / UPLOAD',
    downloadSlash: 'Download / DOWNLOAD',
    uploadToRemote: 'Upload to remote',
    downloadFromRemote: 'Download from remote',
    terminalTitle: 're-mark - bash - 80x24',
    terminalSync: 'sync',
    terminalConfig: 'cfg',
    terminalLocalComment: 'bookmarks',
    terminalRemoteComment: 'synced',
    terminalStatus: 'status',
    terminalInSync: 'in sync',
    terminalUpload: 'upload',
    terminalDownload: 'download',
    terminalEnrich: 'enrich',
    terminalCleanTitles: 'clean titles',
    terminalClearPath: './local/bookmarks',
    minimalKicker: 'BOOKMARK ARCHIVE',
    minimalLocal: 'Local bookmarks',
    minimalRemote: 'Remote sync',
    minimalVolume: 'Volume I',
    remoteTip: 'Remote count updates only after Refresh, Upload, Download, or Auto-sync completes.',
    refresh: 'Refresh',
    upload: 'Upload',
    download: 'Download',
    enrich: 'Enrich Bookmarks',
    cleanTitles: 'Clean Titles',
    smartEnrich: 'Smart Enrich',
    stopProcessing: 'Stop Processing',
    clear: 'Clear Local Bookmarks',
    settings: 'Settings',
    confirmOverwrite: 'Remote was updated since your last sync. Overwrite remote with your local bookmarks?',
    confirmClear: 'Clear all local bookmarks?',
    processing: 'Processing...',
    searchPlaceholder: 'Search local bookmarks',
    searching: 'Searching...',
    noSearchResults: 'No matching bookmarks',
    searchFailed: 'Failed to search bookmarks',
    enrichRunning: (processed: number, remaining: number) => `Processing ${processed} done, ${remaining} left`,
    enrichPaused: (remaining: number) => `Processing paused, ${remaining} left`,
    enrichCompleted: (processed: number) => `Processing complete, ${processed} done`,
    enrichFailed: 'Action failed'
  },
  zh: {
    subtitle: '普通的高级书签',
    bookmarkManager: '书签管理器',
    local: '本地',
    remote: '远端',
    localTotal: '书签总数',
    remoteStorage: '远端存储',
    localTag: 'LOCAL',
    remoteTag: 'REMOTE',
    savedBookmarks: '已保存书签',
    syncedBookmarks: '已同步书签',
    saved: '已保存',
    synced: '已同步',
    uploadSlash: '上传 / UPLOAD',
    downloadSlash: '下载 / DOWNLOAD',
    uploadToRemote: '上传至远端',
    downloadFromRemote: '从远端下载',
    terminalTitle: 're-mark - bash - 80x24',
    terminalSync: 'sync',
    terminalConfig: 'cfg',
    terminalLocalComment: 'bookmarks',
    terminalRemoteComment: 'synced',
    terminalStatus: 'status',
    terminalInSync: 'in sync',
    terminalUpload: '上传',
    terminalDownload: '下载',
    terminalEnrich: '富化',
    terminalCleanTitles: '清理标题',
    terminalClearPath: './local/bookmarks',
    minimalKicker: '書　籤　管　理',
    minimalLocal: '本地书签',
    minimalRemote: '远端同步',
    minimalVolume: '卷之一',
    remoteTip: '远端数量仅在刷新、上传、下载或自动同步完成后更新。',
    refresh: '刷新',
    upload: '上传',
    download: '下载',
    enrich: '智能富化',
    cleanTitles: '清理标题',
    smartEnrich: '智能富化',
    stopProcessing: '停止处理',
    clear: '清空本地书签',
    settings: '设置',
    confirmOverwrite: '检测到远端在你上次同步后已更新，是否仍要强制上传覆盖远端？',
    confirmClear: '确定清空本地所有书签？',
    processing: '处理中...',
    searchPlaceholder: '搜索本地书签',
    searching: '搜索中...',
    noSearchResults: '没有匹配的书签',
    searchFailed: '搜索书签失败',
    enrichRunning: (processed: number, remaining: number) => `处理中：已处理 ${processed}，剩余 ${remaining}`,
    enrichPaused: (remaining: number) => `处理已暂停，剩余 ${remaining}`,
    enrichCompleted: (processed: number) => `处理完成，已处理 ${processed}`,
    enrichFailed: '处理失败'
  }
};

export default function App() {
  const locale = useMemo(() => navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en', []);
  const t = locales[locale] ?? locales.en;
  const [counts, setCounts] = useState({ local: 0, remote: 0 });
  const [loading, setLoading] = useState(false);
  const [enrichmentMode, setEnrichmentMode] = useState<EnrichmentMode>('hidden');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [enrichJob, setEnrichJob] = useState<EnrichJobState | null>(null);
  const [theme, setTheme] = useState<ThemeName>('brutalist');

  useEffect(() => {
    loadCounts();
    loadSettings();
    loadEnrichJob();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.enrichJob) setEnrichJob((changes.enrichJob.newValue as EnrichJobState | undefined) ?? null);
      if (changes.theme?.newValue) setTheme(changes.theme.newValue as ThemeName);
    };

    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }

    let isActive = true;
    setSearchLoading(true);
    setSearchError('');

    const timeoutId = window.setTimeout(async () => {
      try {
        const tree = await getBookmarkTree();
        const items = flattenBookmarkTreeForSearch(tree);
        if (!isActive) return;
        setSearchResults(searchBookmarkItems(items, query));
      } catch {
        if (!isActive) return;
        setSearchResults([]);
        setSearchError(t.searchFailed);
      } finally {
        if (isActive) setSearchLoading(false);
      }
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery, t.searchFailed]);

  async function loadCounts() {
    const data = await browser.storage.local.get(['localCount', 'remoteCount']);
    setCounts({ local: data.localCount || 0, remote: data.remoteCount || 0 });
  }

  async function loadSettings() {
    const settings = await getSettings();
    setEnrichmentMode(getEnrichmentMode(settings));
    setTheme(settings.theme);
  }

  async function loadEnrichJob() {
    const data = await browser.storage.local.get(['enrichJob']);
    setEnrichJob((data.enrichJob as EnrichJobState | undefined) ?? null);
  }

  async function runAction(action: string, payload?: Record<string, unknown>) {
    return await browser.runtime.sendMessage({ action, ...(payload ?? {}) });
  }

  async function handleAction(action: string, payload?: Record<string, unknown>) {
    if (loading) return;
    setLoading(true);
    try {
      if (action === 'enrich') {
        const settings = await getSettings();
        const mode = getEnrichmentMode(settings);
        await ensureServicePermissionsDuringUserGesture(settings, mode);
      }

      let response = await runAction(action, payload);
      let skipAlert = false;

      if (!response.success && response.code === 'REMOTE_CONFLICT' && action === 'upload' && !(payload as any)?.force) {
        const ok = confirm(t.confirmOverwrite);
        if (ok) response = await runAction('upload', { force: true });
        else skipAlert = true;
      }

      if (!response.success && !skipAlert) alert(response.error);
      if (action === 'enrich' || action === 'stopEnrich') await loadEnrichJob();
      await loadCounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function openBookmark(item: BookmarkItem) {
    if (!item.url) return;
    await browser.tabs.create({ url: item.url });
  }

  function getSearchUrlLabel(url: string) {
    try {
      const parsedUrl = new URL(url);
      return `${parsedUrl.hostname}${parsedUrl.pathname === '/' ? '' : parsedUrl.pathname}`;
    } catch {
      return url;
    }
  }

  const enrichStatusText = getEnrichStatusText(enrichJob, {
    running: t.enrichRunning,
    paused: t.enrichPaused,
    completed: t.enrichCompleted,
    failed: t.enrichFailed
  });
  const isEnrichRunning = enrichJob?.state === 'running' || enrichJob?.state === 'paused';
  const version = browser.runtime.getManifest().version;

  function getSearchPlaceholder() {
    if (theme === 'brutalist') return 'SEARCH BOOKMARKS_';
    if (theme === 'terminal') return 'search bookmarks...';
    if (theme === 'minimal') return locale === 'zh' ? '検索・搜寻书签' : 'search archive';
    if (theme === 'glass') return locale === 'zh' ? '搜索书签' : 'Search bookmarks';
    return t.searchPlaceholder;
  }

  function renderBrandTitle() {
    if (theme === 'brutalist') return <>Re<span>:</span>Mark</>;
    if (theme === 'minimal') return <>Re:<span>Mark</span></>;
    return <>Re<span>:Mark</span></>;
  }

  function renderHeader() {
    if (theme === 'terminal') {
      return (
        <header className="popup-header">
          <div className="terminal-header">
            <div className="terminal-bar">
              <span className="terminal-dot red"></span>
              <span className="terminal-dot yellow"></span>
              <span className="terminal-dot green"></span>
              <span className="terminal-title">{t.terminalTitle}</span>
              <div className="header-actions terminal-actions">
                <button className="icon-btn header-command-btn" onClick={() => handleAction('refresh')} title={t.refresh} disabled={loading}>
                  {t.terminalSync}
                </button>
                <button className="icon-btn header-command-btn" onClick={() => browser.runtime.openOptionsPage()} title={t.settings}>
                  {t.terminalConfig}
                </button>
              </div>
            </div>
            <div className="terminal-brand-line">
              <span className="terminal-prompt">~$</span>
              <h1>re<span>:</span>mark</h1>
              <span className="terminal-cursor"></span>
            </div>
          </div>
        </header>
      );
    }

    return (
      <header className="popup-header">
        <div className="logo-area">
          {(theme === 'editorial' || theme === 'glass') && <img src="/icon/48.png" className="logo-image" alt="Re:Mark" />}
          <div className="brand-copy">
            <h1>{renderBrandTitle()}</h1>
            <p>{theme === 'brutalist' ? t.bookmarkManager : theme === 'minimal' ? t.minimalKicker : t.subtitle}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => handleAction('refresh')} title={t.refresh} disabled={loading}>
            <Icons.Refresh />
          </button>
          <button className="icon-btn" onClick={() => browser.runtime.openOptionsPage()} title={t.settings}>
            <Icons.Settings />
          </button>
        </div>
      </header>
    );
  }

  function renderSearch() {
    return (
      <section className="search-section" aria-label={t.searchPlaceholder}>
        <div className="search-box">
          <span className="search-icon"><Icons.Search /></span>
          <input
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={getSearchPlaceholder()}
            aria-label={t.searchPlaceholder}
          />
        </div>

        {searchQuery.trim() && (
          <div className="search-results">
            {searchLoading && <div className="search-status">{t.searching}</div>}
            {!searchLoading && searchError && <div className="search-status error">{searchError}</div>}
            {!searchLoading && !searchError && searchResults.length === 0 && <div className="search-status">{t.noSearchResults}</div>}
            {!searchLoading && !searchError && searchResults.map(item => (
              <button key={item.id} className="search-result" type="button" onClick={() => openBookmark(item)}>
                <span className="search-result-main">
                  <span className="search-result-title">{item.title || item.url}</span>
                  <span className="search-result-url">{getSearchUrlLabel(item.url ?? '')}</span>
                </span>
                <span className="search-result-icon"><Icons.External /></span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  function getStatLabel(kind: 'local' | 'remote') {
    if (theme === 'brutalist') return kind === 'local' ? t.localTotal : t.remoteStorage;
    if (theme === 'minimal') return kind === 'local' ? t.minimalLocal : t.minimalRemote;
    return kind === 'local' ? t.local : t.remote;
  }

  function getStatSub(kind: 'local' | 'remote') {
    if (theme === 'glass') return kind === 'local' ? t.saved : t.synced;
    return kind === 'local' ? t.savedBookmarks : t.syncedBookmarks;
  }

  function renderStats() {
    if (theme === 'brutalist') {
      return (
        <div className="stats-container">
          {(['local', 'remote'] as const).map(kind => (
            <div key={kind} className={`stat-card ${kind}`} title={kind === 'remote' ? t.remoteTip : undefined}>
              <span className="stat-value">{kind === 'local' ? counts.local : counts.remote}</span>
              <span className="stat-label">{getStatLabel(kind)}</span>
              <span className={`stat-tag ${kind}`}>{kind === 'local' ? t.localTag : t.remoteTag}</span>
            </div>
          ))}
        </div>
      );
    }

    if (theme === 'terminal') {
      return (
        <div className="stats-container terminal-stats">
          <div className="terminal-stat-line">
            <span className="terminal-stat-key">local.count</span>
            <span className="terminal-comment">//</span>
            <span className="terminal-stat-value">{counts.local}</span>
            <span className="terminal-comment">{t.terminalLocalComment}</span>
          </div>
          <div className="terminal-stat-line">
            <span className="terminal-stat-key">remote.count</span>
            <span className="terminal-comment">//</span>
            <span className="terminal-stat-value remote">{counts.remote}</span>
            <span className="terminal-comment">{t.terminalRemoteComment}</span>
          </div>
          <div className="terminal-divider">---------------------------------</div>
          <div className="terminal-stat-line compact">
            <span className="terminal-stat-key">{t.terminalStatus}</span>
            <span className="terminal-state-dot"></span>
            <span className="terminal-stat-value">{t.terminalInSync}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="stats-container">
        {(['local', 'remote'] as const).map(kind => (
          <div key={kind} className={`stat-card ${kind}`} title={kind === 'remote' ? t.remoteTip : undefined}>
            <span className={`stat-mark ${kind}`}></span>
            <div className="stat-header">
              <span className="stat-label">{getStatLabel(kind)} {kind === 'remote' && <span className="icon-help"><Icons.Help /></span>}</span>
              <span className={`stat-badge ${kind}`}></span>
            </div>
            <span className="stat-value">{kind === 'local' ? counts.local : counts.remote}</span>
            <span className="stat-sub">{getStatSub(kind)}</span>
            <span className={`stat-tag ${kind}`}>{kind === 'local' ? t.localTag : t.remoteTag}</span>
          </div>
        ))}
      </div>
    );
  }

  function getActionLabel(action: 'upload' | 'download' | 'enrich') {
    if (loading) return t.processing;
    if (action === 'enrich' && isEnrichRunning) return t.stopProcessing;
    if (action === 'enrich') return enrichmentMode === 'smartEnrichment' ? t.smartEnrich : t.cleanTitles;
    if (theme === 'brutalist') return action === 'upload' ? t.uploadSlash : t.downloadSlash;
    if (theme === 'editorial') return action === 'upload' ? t.uploadToRemote : t.downloadFromRemote;
    if (theme === 'minimal' && locale === 'zh') return action === 'upload' ? '上　传' : '下　载';
    return action === 'upload' ? t.upload : t.download;
  }

  function renderTerminalAction(action: 'upload' | 'download' | 'enrich') {
    if (action === 'upload') {
      return (
        <>
          <span className="command-name">push</span>
          <span className="command-flag">--remote</span>
          <span>origin</span>
          <span className="command-desc">{t.terminalUpload}</span>
        </>
      );
    }

    if (action === 'download') {
      return (
        <>
          <span className="command-name">pull</span>
          <span className="command-flag">--force</span>
          <span>origin</span>
          <span className="command-desc">{t.terminalDownload}</span>
        </>
      );
    }

    return (
      <>
        <span className="command-name">{isEnrichRunning ? 'stop' : enrichmentMode === 'smartEnrichment' ? 'enrich' : 'clean-title'}</span>
        <span className="command-flag">{isEnrichRunning ? '--now' : enrichmentMode === 'smartEnrichment' ? '--ai' : '--title'}</span>
        <span>local</span>
        <span className="command-desc">{enrichmentMode === 'smartEnrichment' ? t.terminalEnrich : t.terminalCleanTitles}</span>
      </>
    );
  }

  function renderActionButton(action: 'upload' | 'download' | 'enrich') {
    const className = action === 'upload' ? 'action-card primary upload' : action === 'download' ? 'action-card secondary download' : 'action-card full-width enrich';
    const actionName = action === 'upload' ? 'upload' : action === 'download' ? 'download' : isEnrichRunning ? 'stopEnrich' : 'enrich';
    const icon = action === 'upload' ? <Icons.Upload /> : action === 'download' ? <Icons.Download /> : <Icons.Enrich />;

    return (
      <button key={action} className={className} onClick={() => handleAction(actionName)} disabled={loading}>
        {theme === 'terminal' ? renderTerminalAction(action) : (
          <>
            <span className="action-icon">{icon}</span>
            <span>{getActionLabel(action)}</span>
          </>
        )}
      </button>
    );
  }

  function renderFooter() {
    const footerMeta = theme === 'brutalist' ? `v${version}` : theme === 'minimal' ? t.minimalVolume : '';

    return (
      <footer className="popup-footer">
        <button className="text-btn danger" onClick={() => confirm(t.confirmClear) && handleAction('clear')} disabled={loading}>
          {theme === 'terminal' ? (
            <>
              <span className="danger-command">rm -rf</span>
              <span className="clear-path">{t.terminalClearPath}</span>
            </>
          ) : (
            <>
              <Icons.Trash />
              <span>{t.clear}</span>
            </>
          )}
        </button>
        {footerMeta && <span className="footer-meta">{footerMeta}</span>}
      </footer>
    );
  }

  return (
    <div className="popup" data-theme={theme}>
      {renderHeader()}
      {renderSearch()}
      {renderStats()}
      <div className="actions-grid">
        {renderActionButton('upload')}
        {renderActionButton('download')}
        {enrichmentMode !== 'hidden' && renderActionButton('enrich')}
      </div>

      {enrichmentMode !== 'hidden' && enrichStatusText && (
        <div className={`enrich-status ${enrichJob?.state ?? 'idle'}`}>
          {enrichStatusText}
        </div>
      )}

      {renderFooter()}
    </div>
  );
}
