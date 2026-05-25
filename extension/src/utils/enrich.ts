import type { BookmarkItem, Settings, TitleLanguage } from '../types';
import { canonicalizeBookmarkUrl } from './canonicalUrl';
import { normalizeGeneratedTitle } from './titleCleaner';

export interface BookmarkEnrichmentResult {
  title: string;
  summary?: string;
  tags?: string[];
  cover: string | boolean;
  canonicalUrl: string;
}

type BookmarkEnrichmentInput = BookmarkItem & {
  titleLanguage?: TitleLanguage;
};

const BASE_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 600_000;
export const JINA_CONTENT_TIMEOUT_MS = 12_000;
export const AI_COMPLETION_TIMEOUT_MS = 25_000;

interface AiResponse {
  title?: string;
  summary?: string;
  tags?: string[];
}

export async function enrichBookmarkWithAI(
  bookmark: BookmarkEnrichmentInput,
  settings: Settings,
  content?: string
): Promise<BookmarkEnrichmentResult> {
  const prompt = content
    ? buildSmartEnrichmentPrompt(bookmark, content)
    : buildTitleCleanupPrompt(bookmark);
  const aiResult = await callAI(settings, prompt);
  const title = normalizeGeneratedTitle(aiResult.title || bookmark.title);

  return {
    title,
    summary: content ? aiResult.summary || '' : undefined,
    tags: content ? normalizeTags(aiResult.tags) : undefined,
    cover: bookmark.url ? getFaviconUrl(bookmark.url) : false,
    canonicalUrl: bookmark.url ? canonicalizeBookmarkUrl(bookmark.url) : ''
  };
}

export async function fetchJinaContent(url: string, jinaApiKey: string): Promise<string> {
  if (!jinaApiKey.trim()) throw new Error('Jina API key is required for smart enrichment');

  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: 'text/plain',
      Authorization: `Bearer ${jinaApiKey}`
    },
    signal: AbortSignal.timeout(JINA_CONTENT_TIMEOUT_MS)
  });

  if (!response.ok) throw new Error(`Jina fetch failed: ${response.status}`);

  const text = (await response.text()).trim();
  if (text.length < 50) throw new Error('Jina returned insufficient content');
  return text.slice(0, 3000);
}

export function buildTitleCleanupPrompt(bookmark: BookmarkEnrichmentInput): string {
  return [
    'You are cleaning a browser bookmark title.',
    'Return valid JSON only. Do not return markdown.',
    'Required JSON shape: {"title":"..."}',
    'Rules:',
    '- The title field is required and must be non-empty.',
    getTitleLanguageInstruction(bookmark),
    '- Title: concise bookmark title, 2 to 6 words.',
    '- Keep the site, product, document, or service name when useful.',
    '- Remove marketing copy, login noise, user emails, tracking parameters, dates, prices, and generic suffixes.',
    '- If the current title is vague or noisy, infer a readable title from the URL.',
    '- Never return {}, null, empty strings, or empty arrays.',
    '',
    `URL: ${bookmark.url || ''}`,
    `Current title: ${bookmark.title}`
  ].join('\n');
}

export function buildSmartEnrichmentPrompt(bookmark: BookmarkEnrichmentInput, content: string): string {
  return [
    'You are cleaning and enriching a browser bookmark.',
    'Return valid JSON only. Do not return markdown.',
    'Required JSON shape: {"title":"...","summary":"...","tags":["..."]}',
    'Rules:',
    '- All fields are required and must be non-empty.',
    getTitleLanguageInstruction(bookmark),
    '- Title: concise browser bookmark title, 2 to 6 words.',
    '- Summary: one short Chinese sentence, around 20 characters.',
    '- Tags: 1 to 3 short Chinese tags, no duplicate brand names.',
    '- Remove marketing copy, login noise, user emails, tracking parameters, dates, prices, and generic suffixes.',
    '- If page content is insufficient, infer from URL and current title.',
    '- Never return {}, null, empty strings, or empty arrays.',
    '',
    `URL: ${bookmark.url || ''}`,
    `Current title: ${bookmark.title}`,
    `Content: ${content}`
  ].join('\n');
}

function getTitleLanguageInstruction(bookmark: BookmarkEnrichmentInput): string {
  const language = getBookmarkTitleLanguage(bookmark);
  if (language === 'zh-CN') {
    return [
      '- Title language: Simplified Chinese.',
      '- Preserve important original terms exactly when they are names, acronyms, protocols, file formats, product names, brand names, API names, SDK names, CLI names, library names, or technical keywords. Examples: WebDAV, OAuth, API, SDK, CLI, GitHub, Cloudflare, AWS, S3, npm, Docker.'
    ].join('\n');
  }

  if (language !== 'auto') {
    return [
      `- Title language: ${language}.`,
      '- Preserve important original terms exactly when they are names, acronyms, protocols, file formats, product names, brand names, API names, SDK names, CLI names, library names, or technical keywords. Examples: WebDAV, OAuth, API, SDK, CLI, GitHub, Cloudflare, AWS, S3, npm, Docker.'
    ].join('\n');
  }

  return [
    '- Title language: automatically match the dominant language of the current title or page content.',
    '- Preserve important original terms exactly when they are names, acronyms, protocols, file formats, product names, brand names, API names, SDK names, CLI names, library names, or technical keywords. Examples: WebDAV, OAuth, API, SDK, CLI, GitHub, Cloudflare, AWS, S3, npm, Docker.'
  ].join('\n');
}

function getBookmarkTitleLanguage(bookmark: BookmarkEnrichmentInput): TitleLanguage {
  const language = bookmark.titleLanguage?.trim();
  return language || 'auto';
}

async function callAI(settings: Settings, prompt: string): Promise<AiResponse> {
  const response = await fetch(settings.aiApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 180
    }),
    signal: AbortSignal.timeout(AI_COMPLETION_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new Error(`AI API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return parseAiResponse(result?.choices?.[0]?.message?.content || '');
}

function parseAiResponse(text: string): AiResponse {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  return {
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag: unknown) => typeof tag === 'string') : undefined
  };
}

function normalizeTags(tags?: string[]): string[] {
  return Array.from(new Set((tags ?? []).map(tag => tag.trim()).filter(Boolean))).slice(0, 3);
}

export function isRetryableEnrichmentError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(message) || /rate limit|too many requests/i.test(message);
}

export function getRetryDelayMs(attempts: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_DELAY_MS);
}

function getFaviconUrl(url: string): string | boolean {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return false;
  }
}
