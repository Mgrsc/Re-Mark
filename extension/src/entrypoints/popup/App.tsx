import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
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
  Bookmark: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
  ),
  Help: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  )
};

const locales = {
  en: {
    subtitle: 'Ordinary Advanced Bookmarks',
    local: 'Local',
    remote: 'Remote',
    remoteTip: 'Remote count updates only after Refresh, Upload, Download, or Auto-sync completes.',
    refresh: 'Refresh',
    upload: 'Upload',
    download: 'Download',
    enrich: 'Enrich Bookmarks',
    clear: 'Clear Local Bookmarks',
    settings: 'Settings',
    confirmOverwrite: 'Remote was updated since your last sync. Overwrite remote with your local bookmarks?',
    confirmClear: 'Clear all local bookmarks?',
    processing: 'Processing...'
  },
  zh: {
    subtitle: '普通的高级书签',
    local: '本地',
    remote: '远端',
    remoteTip: '远端数量仅在刷新、上传、下载或自动同步完成后更新。',
    refresh: '刷新',
    upload: '上传',
    download: '下载',
    enrich: '智能富化',
    clear: '清空本地书签',
    settings: '设置',
    confirmOverwrite: '检测到远端在你上次同步后已更新，是否仍要强制上传覆盖远端？',
    confirmClear: '确定清空本地所有书签？',
    processing: '处理中...'
  }
};

export default function App() {
  const locale = useMemo(() => navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en', []);
  const t = locales[locale] ?? locales.en;
  const [counts, setCounts] = useState({ local: 0, remote: 0 });
  const [loading, setLoading] = useState(false);
  const [hasWebIntegration, setHasWebIntegration] = useState(false);

  useEffect(() => {
    loadCounts();
    checkWebIntegration();
  }, []);

  async function loadCounts() {
    const data = await browser.storage.local.get(['localCount', 'remoteCount']);
    setCounts({ local: data.localCount || 0, remote: data.remoteCount || 0 });
  }

  async function checkWebIntegration() {
    const settings = await getSettings();
    setHasWebIntegration(!!(settings.webUrl && settings.apiSecret));
  }

  async function runAction(action: string, payload?: Record<string, unknown>) {
    return await browser.runtime.sendMessage({ action, ...(payload ?? {}) });
  }

  async function handleAction(action: string, payload?: Record<string, unknown>) {
    if (loading) return;
    setLoading(true);
    try {
      let response = await runAction(action, payload);
      let skipAlert = false;

      if (!response.success && response.code === 'REMOTE_CONFLICT' && action === 'upload' && !(payload as any)?.force) {
        const ok = confirm(t.confirmOverwrite);
        if (ok) response = await runAction('upload', { force: true });
        else skipAlert = true;
      }

      if (!response.success && !skipAlert) alert(response.error);
      await loadCounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="popup">
      <header className="popup-header">
        <div className="logo-area">
          <img src="/icon/48.png" className="logo-image" alt="Re:Mark" />
          <div>
            <h1>Re:Mark<span style={{ color: '#e74c3c', fontSize: '2rem', lineHeight: 0.5 }}>.</span></h1>
            <p>{t.subtitle}</p>
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

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon local"><Icons.Bookmark /></div>
          <div className="stat-info">
            <span className="stat-value">{counts.local}</span>
            <span className="stat-label">{t.local}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon remote">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{counts.remote}</span>
            <span className="stat-label" title={t.remoteTip}>{t.remote} <span className="icon-help"><Icons.Help /></span></span>
          </div>
        </div>
      </div>

      <div className="actions-grid">
        <button className="action-card primary" onClick={() => handleAction('upload')} disabled={loading}>
          <div className="action-icon"><Icons.Upload /></div>
          <span>{loading ? t.processing : t.upload}</span>
        </button>

        <button className="action-card secondary" onClick={() => handleAction('download')} disabled={loading}>
          <div className="action-icon"><Icons.Download /></div>
          <span>{loading ? t.processing : t.download}</span>
        </button>

        {hasWebIntegration && (
          <button className="action-card full-width enrich" onClick={() => handleAction('enrich')} disabled={loading}>
            <div className="action-icon"><Icons.Enrich /></div>
            <span>{loading ? t.processing : t.enrich}</span>
          </button>
        )}
      </div>

      <footer className="popup-footer">
        <button className="text-btn danger" onClick={() => confirm(t.confirmClear) && handleAction('clear')} disabled={loading}>
          <Icons.Trash />
          <span>{t.clear}</span>
        </button>
      </footer>
    </div>
  );
}
