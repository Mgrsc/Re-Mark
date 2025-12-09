import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '../../utils/storage';
import type { Settings } from '../../types';
import './style.css';

const Icons = {
  Github: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
  ),
  Globe: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  ),
  Sync: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/><path d="M2.5 22v-6h6"/><path d="M2.66 8.43a10 10 0 1 1 .57 8.38"/></svg>
  ),
  Shield: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  )
};

export default function App() {
  const [settings, setSettings] = useState<Settings>({
    githubToken: '',
    gistId: '',
    apiSecret: '',
    webUrl: '',
    autoSync: false,
    syncDelay: 5
  });
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState('en');

  useEffect(() => {
    loadSettings();
    detectLanguage();
  }, []);

  function detectLanguage() {
    const userLang = navigator.language || 'en';
    setLang(userLang.startsWith('zh') ? 'zh' : 'en');
  }

  async function loadSettings() {
    const data = await getSettings();
    setSettings(data);
  }

  async function handleSave() {
    try {
      if (settings.webUrl) await ensureWebPermission(settings.webUrl);

      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save or request permission');
    }
  }

  function updateField(field: keyof Settings, value: any) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  const t = lang === 'zh' ? {
    title: 'Re:Mark 设置',
    githubConfig: 'GitHub 配置',
    githubToken: 'GitHub Token',
    githubTokenPlaceholder: 'ghp_xxxxxxxxxxxx',
    githubTokenHint: '创建 Token',
    githubTokenScope: '权限',
    gistId: 'Gist ID（可选）',
    gistIdPlaceholder: '首次上传时自动生成',
    gistIdHint: '留空自动创建，或粘贴已有 Gist ID',
    webIntegration: 'Web 集成（可选）',
    webIntegrationDesc: '部署 Web 界面以获得 AI 增强浏览和自动内容富化',
    apiSecret: 'API 密钥',
    apiSecretPlaceholder: '你的密钥',
    apiSecretHint: '必须与 Web 部署中的密钥匹配',
    webUrl: 'Web URL',
    webUrlPlaceholder: 'https://remark.vercel.app',
    webUrlHint: '你的 Vercel 部署地址',
    autoSync: '自动同步',
    enableAutoSync: '启用自动同步',
    autoSyncDesc: '书签变化后自动上传（带延迟）',
    syncDelay: '同步延迟（分钟）',
    syncDelayHint: '自动上传前的等待时间',
    saveSettings: '保存设置',
    saved: '已保存！',
    privacyTitle: '隐私与权限说明',
    privacyLocal: 'GitHub Token 仅保存在本机 storage.local 中，用于访问你自己的 Gist，不会上传到其他服务器。',
    privacyUsage: '书签数据只会在你手动或自动同步时发送到你配置的 Gist 或可选的 Web 服务，开发者不会收集。',
    permissionsTitle: '所需权限',
    permissions: [
      'bookmarks：读取和还原你的书签结构以便同步/清空',
      'storage：在本机保存设置、计数和凭据',
      'notifications：在同步或富化完成时提醒你',
      '可选站点权限：首次富化时会请求你配置的 Web 域名，仅用于调用 /api/enrich'
    ],
    permissionDenied: '未获得对填入 Web URL 的站点权限，富化可能失败。',
    invalidWebUrl: '请输入有效的 Web URL（例如：https://example.com）。'
  } : {
    title: 'Re:Mark Settings',
    githubConfig: 'GitHub Configuration',
    githubToken: 'GitHub Token',
    githubTokenPlaceholder: 'ghp_xxxxxxxxxxxx',
    githubTokenHint: 'Create token',
    githubTokenScope: 'scope',
    gistId: 'Gist ID (Optional)',
    gistIdPlaceholder: 'Auto-generated on first upload',
    gistIdHint: 'Leave empty to auto-create, or paste existing Gist ID',
    webIntegration: 'Web Integration (Optional)',
    webIntegrationDesc: 'Deploy the web interface for AI-enhanced browsing and automatic content enrichment',
    apiSecret: 'API Secret',
    apiSecretPlaceholder: 'Your secret key',
    apiSecretHint: 'Must match the secret in your web deployment',
    webUrl: 'Web URL',
    webUrlPlaceholder: 'https://remark.vercel.app',
    webUrlHint: 'Your deployed Vercel URL',
    autoSync: 'Auto Sync',
    enableAutoSync: 'Enable auto sync',
    autoSyncDesc: 'Automatically upload bookmarks after changes (with delay)',
    syncDelay: 'Sync Delay (minutes)',
    syncDelayHint: 'Wait time before auto-uploading changes',
    saveSettings: 'Save Settings',
    saved: 'Saved!',
    privacyTitle: 'Privacy & Permissions',
    privacyLocal: 'GitHub Token is stored locally (storage.local) and only used to access your own Gist.',
    privacyUsage: 'Bookmarks are sent only when you trigger sync to your configured Gist or optional web service; the developer does not receive your data.',
    permissionsTitle: 'Permissions',
    permissions: [
      'bookmarks: read/restore your bookmark tree for sync/clear',
      'storage: save settings, counts, and credentials locally',
      'notifications: show status for sync/enrich actions',
      'Optional site access: requested for your configured Web URL to call /api/enrich'
    ],
    permissionDenied: 'Site permission was denied for the configured Web URL; enrich may fail.',
    invalidWebUrl: 'Please enter a valid Web URL (e.g., https://example.com).'
  };

  return (
    <div className="options">
      <header className="options-header">
        <h1>{t.title}</h1>
      </header>

      <div className="options-content">
        <section className="card section-github">
          <div className="card-header">
            <div className="icon-box blue"><Icons.Github /></div>
            <h2>{t.githubConfig}</h2>
          </div>

          <div className="card-body">
            <div className="field">
              <label>{t.githubToken}</label>
              <input type="password" className="input-primary" value={settings.githubToken} onChange={e => updateField('githubToken', e.target.value)} placeholder={t.githubTokenPlaceholder} />
              <small>
                <a href="https://github.com/settings/tokens/new" target="_blank">{t.githubTokenHint}</a> with <code>gist</code> {t.githubTokenScope}
              </small>
            </div>

            <div className="field">
              <label>{t.gistId}</label>
              <input type="text" className="input-primary" value={settings.gistId || ''} onChange={e => updateField('gistId', e.target.value)} placeholder={t.gistIdPlaceholder} />
              <small>{t.gistIdHint}</small>
            </div>
          </div>
        </section>

        <section className="card section-web">
          <div className="card-header">
            <div className="icon-box purple"><Icons.Globe /></div>
            <h2>{t.webIntegration}</h2>
          </div>

          <div className="card-body">
            <p className="description-text">{t.webIntegrationDesc}</p>

            <div className="field">
              <label>{t.apiSecret}</label>
              <input type="password" className="input-primary" value={settings.apiSecret} onChange={e => updateField('apiSecret', e.target.value)} placeholder={t.apiSecretPlaceholder} />
              <small>{t.apiSecretHint}</small>
            </div>

            <div className="field">
              <label>{t.webUrl}</label>
              <input type="text" className="input-primary" value={settings.webUrl} onChange={e => updateField('webUrl', e.target.value)} placeholder={t.webUrlPlaceholder} />
              <small>{t.webUrlHint}</small>
            </div>
          </div>
        </section>

        <section className="card section-sync">
          <div className="card-header">
            <div className="icon-box green"><Icons.Sync /></div>
            <h2>{t.autoSync}</h2>
          </div>

          <div className="card-body">
            <div className="checkbox-field">
              <label className="checkbox-label">
                <input type="checkbox" className="checkbox-input" checked={settings.autoSync} onChange={e => updateField('autoSync', e.target.checked)} />
                <span className="checkbox-visual"></span>
                <div className="checkbox-text">
                  <span className="checkbox-title">{t.enableAutoSync}</span>
                  <span className="checkbox-subtitle">{t.autoSyncDesc}</span>
                </div>
              </label>
            </div>

            {settings.autoSync && (
              <div className="field">
                <label>{t.syncDelay}</label>
                <input type="number" className="input-primary" min="1" max="60" value={settings.syncDelay} onChange={e => updateField('syncDelay', parseInt(e.target.value))} />
                <small>{t.syncDelayHint}</small>
              </div>
            )}
          </div>
        </section>

        <div className="options-actions-sticky">
          <button className={`btn-save ${saved ? 'saved' : ''}`} onClick={handleSave}>
            {saved ? <><Icons.Check /> {t.saved}</> : t.saveSettings}
          </button>
        </div>

        <section className="card section-privacy">
          <div className="card-header">
            <div className="icon-box gray"><Icons.Shield /></div>
            <h2>{t.privacyTitle}</h2>
          </div>
          <div className="card-body">
            <div className="info-box">
              <p>{t.privacyLocal}</p>
              <p style={{ marginTop: '0.5rem' }}>{t.privacyUsage}</p>
              <h3 style={{ marginTop: '1rem', fontSize: '1rem', color: '#334155' }}>{t.permissionsTitle}</h3>
              <ul>
                {t.permissions.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

async function ensureWebPermission(webUrl: string) {
  if (!webUrl) return;

  let origin: string;
  try {
    const url = new URL(webUrl);
    origin = `${url.origin}/*`;
  } catch {
    throw new Error(localizedInvalidUrlMessage(webUrl));
  }

  const hasPermission = await browser.permissions.contains({ origins: [origin] });
  if (hasPermission) return;

  const granted = await browser.permissions.request({ origins: [origin] });
  if (!granted) throw new Error(localizedPermissionDeniedMessage());
}

function localizedInvalidUrlMessage(_webUrl: string): string {
  const lang = navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return lang === 'zh' ? '请输入有效的 Web URL（例如：https://example.com）。' : 'Please enter a valid Web URL (e.g., https://example.com).';
}

function localizedPermissionDeniedMessage(): string {
  const lang = navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return lang === 'zh' ? '未获得对填入 Web URL 的站点权限，富化可能失败。' : 'Site permission was denied for the configured Web URL; enrich may fail.';
}
