export interface BookmarkItem {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  order: number;
  createdAt: number;
  ai?: {
    summary: string;
    tags: string[];
    cover: string;
    enrichedAt: number;
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
  apiSecret: string;
  webUrl: string;
  autoSync: boolean;
  syncDelay: number;
}
