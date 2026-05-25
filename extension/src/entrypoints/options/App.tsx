import { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../../utils/storage';
import { THEME_OPTIONS } from '../../utils/themes';
import { getEnrichmentMode } from '../../utils/enrichmentMode';
import { ensureServicePermissionsDuringUserGesture } from '../../utils/servicePermissions';
import type { Settings, ThemeName } from '../../types';
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
  ),
  Eye: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  EyeOff: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  )
};

export default function App() {
  const [settings, setSettings] = useState<Settings>({
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
  });
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState('en');
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [showJinaApiKey, setShowJinaApiKey] = useState(false);
  const [useCustomTitleLanguage, setUseCustomTitleLanguage] = useState(false);

  useEffect(() => {
    loadSettings();
    detectLanguage();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  function detectLanguage() {
    const userLang = navigator.language || 'en';
    setLang(userLang.startsWith('zh') ? 'zh' : 'en');
  }

  async function loadSettings() {
    const data = await getSettings();
    setSettings(data);
    setUseCustomTitleLanguage(data.titleLanguage !== 'auto');
  }

  async function handleSave() {
    try {
      const normalizedSettings = {
        ...settings,
        titleLanguage: useCustomTitleLanguage ? settings.titleLanguage.trim() || 'auto' : 'auto'
      };
      const mode = getEnrichmentMode(normalizedSettings);
      if (mode !== 'hidden') await ensureServicePermissionsDuringUserGesture(settings, mode);

      await saveSettings(normalizedSettings);
      setSettings(normalizedSettings);
      setUseCustomTitleLanguage(normalizedSettings.titleLanguage !== 'auto');
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
    aiConfig: 'AI 配置',
    aiConfigDesc: '扩展直接调用你的 AI 服务；未配置 AI Key 时不会显示标题清理按钮。',
    aiApiKey: 'AI API Key',
    aiApiKeyPlaceholder: 'sk-xxxxxxxxxxxx',
    aiApiKeyHint: '用于生成短标题；保存在本机 storage.local 中。',
    aiApiUrl: 'AI API URL',
    aiApiUrlPlaceholder: 'https://api.deepseek.com/v1/chat/completions',
    aiApiUrlHint: '兼容 OpenAI Chat Completions 的接口地址。',
    aiModel: 'AI 模型',
    aiModelPlaceholder: 'deepseek-chat',
    jinaApiKey: 'Jina API Key',
    jinaApiKeyPlaceholder: 'jina_xxxxxxxxxxxx',
    jinaApiKeyHint: '开启智能富化时必填；不再使用 Jina Free。',
    enableSmartEnrichment: '启用智能富化',
    smartEnrichmentDesc: '需要同时配置 AI Key 和 Jina Key，扩展会抓取正文并生成摘要、标签。',
    enrichmentConcurrency: '并发数',
    enrichmentConcurrencyHint: '每批同时处理的书签数量，默认 10。遇到 429 会自动退避重试。',
    titleLanguage: '标题语言',
    titleLanguageHint: '自定义时会把输入内容插入提示词，例如“中文”。WebDAV、API、SDK、品牌名等关键术语会保留原文。',
    titleLanguageAuto: '自动',
    titleLanguageCustom: '自定义',
    titleLanguagePlaceholder: '例如：中文',
    autoSync: '自动同步',
    enableAutoSync: '启用自动同步',
    autoSyncDesc: '书签变化后自动上传（带延迟）',
    syncDelay: '同步延迟（分钟）',
    syncDelayHint: '自动上传前的等待时间',
    appearance: '外观',
    theme: '主题',
    themeHint: '选择扩展弹窗和设置页的视觉主题',
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
      'alarms：在长任务中分批继续处理标题清理或智能富化'
    ]
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
    aiConfig: 'AI Configuration',
    aiConfigDesc: 'The extension calls your AI service directly; the title cleanup action is hidden until an AI key is configured.',
    aiApiKey: 'AI API Key',
    aiApiKeyPlaceholder: 'sk-xxxxxxxxxxxx',
    aiApiKeyHint: 'Used to generate concise titles and stored locally in storage.local.',
    aiApiUrl: 'AI API URL',
    aiApiUrlPlaceholder: 'https://api.deepseek.com/v1/chat/completions',
    aiApiUrlHint: 'OpenAI Chat Completions compatible endpoint.',
    aiModel: 'AI Model',
    aiModelPlaceholder: 'deepseek-chat',
    jinaApiKey: 'Jina API Key',
    jinaApiKeyPlaceholder: 'jina_xxxxxxxxxxxx',
    jinaApiKeyHint: 'Required for Smart Enrich; Jina Free is not used.',
    enableSmartEnrichment: 'Enable Smart Enrich',
    smartEnrichmentDesc: 'Requires both AI and Jina keys; the extension fetches page content and generates summaries and tags.',
    enrichmentConcurrency: 'Concurrency',
    enrichmentConcurrencyHint: 'Bookmarks processed in parallel per batch. Default is 10. 429 errors use automatic backoff.',
    titleLanguage: 'Title Language',
    titleLanguageHint: 'Custom input is inserted into the prompt, for example "Chinese". Key terms such as WebDAV, API, SDK, and brand names are preserved.',
    titleLanguageAuto: 'Auto',
    titleLanguageCustom: 'Custom',
    titleLanguagePlaceholder: 'Example: Chinese',
    autoSync: 'Auto Sync',
    enableAutoSync: 'Enable auto sync',
    autoSyncDesc: 'Automatically upload bookmarks after changes (with delay)',
    syncDelay: 'Sync Delay (minutes)',
    syncDelayHint: 'Wait time before auto-uploading changes',
    appearance: 'Appearance',
    theme: 'Theme',
    themeHint: 'Choose the visual theme for the extension popup and settings page',
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
      'alarms: continue title cleanup or smart enrichment in batches'
    ]
  };

  return (
    <div className="options" data-theme={settings.theme}>
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
              <div className="input-with-toggle">
                <input type={showGithubToken ? "text" : "password"} className="input-primary" value={settings.githubToken} onChange={e => updateField('githubToken', e.target.value)} placeholder={t.githubTokenPlaceholder} />
                <button type="button" className="toggle-visibility" onClick={() => setShowGithubToken(!showGithubToken)} title={showGithubToken ? "隐藏" : "显示"}>
                  {showGithubToken ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
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
            <h2>{t.aiConfig}</h2>
          </div>

          <div className="card-body">
            <p className="description-text">{t.aiConfigDesc}</p>

            <div className="field">
              <label>{t.aiApiKey}</label>
              <div className="input-with-toggle">
                <input type={showAiApiKey ? "text" : "password"} className="input-primary" value={settings.aiApiKey} onChange={e => updateField('aiApiKey', e.target.value)} placeholder={t.aiApiKeyPlaceholder} />
                <button type="button" className="toggle-visibility" onClick={() => setShowAiApiKey(!showAiApiKey)} title={showAiApiKey ? "隐藏" : "显示"}>
                  {showAiApiKey ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
              <small>{t.aiApiKeyHint}</small>
            </div>

            <div className="field">
              <label>{t.aiApiUrl}</label>
              <input type="text" className="input-primary" value={settings.aiApiUrl} onChange={e => updateField('aiApiUrl', e.target.value)} placeholder={t.aiApiUrlPlaceholder} />
              <small>{t.aiApiUrlHint}</small>
            </div>

            <div className="field">
              <label>{t.aiModel}</label>
              <input type="text" className="input-primary" value={settings.aiModel} onChange={e => updateField('aiModel', e.target.value)} placeholder={t.aiModelPlaceholder} />
            </div>

            <div className="field">
              <label>{t.jinaApiKey}</label>
              <div className="input-with-toggle">
                <input type={showJinaApiKey ? "text" : "password"} className="input-primary" value={settings.jinaApiKey} onChange={e => updateField('jinaApiKey', e.target.value)} placeholder={t.jinaApiKeyPlaceholder} />
                <button type="button" className="toggle-visibility" onClick={() => setShowJinaApiKey(!showJinaApiKey)} title={showJinaApiKey ? "隐藏" : "显示"}>
                  {showJinaApiKey ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
              <small>{t.jinaApiKeyHint}</small>
            </div>

            <div className="checkbox-field">
              <label className="checkbox-label">
                <input type="checkbox" className="checkbox-input" checked={settings.enableSmartEnrichment} onChange={e => updateField('enableSmartEnrichment', e.target.checked)} />
                <span className="checkbox-visual"></span>
                <div className="checkbox-text">
                  <span className="checkbox-title">{t.enableSmartEnrichment}</span>
                  <span className="checkbox-subtitle">{t.smartEnrichmentDesc}</span>
                </div>
              </label>
            </div>

            <div className="field">
              <label>{t.enrichmentConcurrency}</label>
              <input
                type="number"
                className="input-primary"
                min="1"
                max="50"
                value={settings.enrichmentConcurrency}
                onChange={e => updateField('enrichmentConcurrency', normalizeConcurrencyInput(e.target.value))}
              />
              <small>{t.enrichmentConcurrencyHint}</small>
            </div>

            <div className="field">
              <label>{t.titleLanguage}</label>
              <div className="segmented-control" role="radiogroup" aria-label={t.titleLanguage}>
                <label>
                  <input
                    type="radio"
                    name="titleLanguageMode"
                    checked={!useCustomTitleLanguage}
                    onChange={() => {
                      setUseCustomTitleLanguage(false);
                      updateField('titleLanguage', 'auto');
                    }}
                  />
                  <span>{t.titleLanguageAuto}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="titleLanguageMode"
                    checked={useCustomTitleLanguage}
                    onChange={() => {
                      setUseCustomTitleLanguage(true);
                      if (settings.titleLanguage === 'auto') updateField('titleLanguage', '');
                    }}
                  />
                  <span>{t.titleLanguageCustom}</span>
                </label>
              </div>
              {useCustomTitleLanguage && (
                <input
                  type="text"
                  className="input-primary input-stacked"
                  value={settings.titleLanguage === 'auto' ? '' : settings.titleLanguage}
                  onChange={e => updateField('titleLanguage', e.target.value)}
                  placeholder={t.titleLanguagePlaceholder}
                />
              )}
              <small>{t.titleLanguageHint}</small>
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

        <section className="card section-appearance">
          <div className="card-header">
            <div className="icon-box yellow"><Icons.Eye /></div>
            <h2>{t.appearance}</h2>
          </div>

          <div className="card-body">
            <div className="field">
              <label>{t.theme}</label>
              <div className="theme-options" role="radiogroup" aria-label={t.theme}>
                {THEME_OPTIONS.map(option => (
                  <label key={option.value} className="theme-option">
                    <input
                      type="radio"
                      name="theme"
                      value={option.value}
                      checked={settings.theme === option.value}
                      onChange={() => updateField('theme', option.value as ThemeName)}
                    />
                    <span className="theme-option-body">
                      <span className="theme-option-code">{option.code}</span>
                      <span className="theme-option-text">
                        <span className="theme-option-name">{option.name}</span>
                        <span className="theme-option-description">{option.description}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <small>{t.themeHint}</small>
            </div>
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
              <p className="info-spaced">{t.privacyUsage}</p>
              <h3>{t.permissionsTitle}</h3>
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

function normalizeConcurrencyInput(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), 50);
}
