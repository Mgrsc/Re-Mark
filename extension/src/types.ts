export type ThemeName = 'brutalist' | 'editorial' | 'terminal' | 'minimal' | 'glass';
export type TitleLanguage = 'auto' | string;

export interface BookmarkItem {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  order: number;
  createdAt: number;
  ai?: {
    title?: string;
    summary: string;
    tags: string[];
    cover: string | boolean;
    enrichedAt: number;
    canonicalUrl?: string;
    sourceTitle?: string;
  };
  aiFailed?: {
    reason: string;
    attempts: number;
    failedAt: number;
  };
}

export interface SyncData {
  version: string;
  updatedAt: number;
  browser: string;
  items: BookmarkItem[];
}

export interface Settings {
  githubToken: string;
  gistId: string;
  aiApiKey: string;
  aiApiUrl: string;
  aiModel: string;
  jinaApiKey: string;
  enableSmartEnrichment: boolean;
  enrichmentConcurrency: number;
  titleLanguage: TitleLanguage;
  autoSync: boolean;
  syncDelay: number;
  theme: ThemeName;
}
