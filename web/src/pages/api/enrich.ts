import type { APIRoute } from 'astro';
import { buildBookmarkEnrichmentPrompt } from '../../prompts/bookmark-enrichment';

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  ai?: any;
  aiFailed?: {
    reason: string;
    attempts: number;
    failedAt: number;
  };
}

export const prerender = false;
const MAX_FAIL_ATTEMPTS = 2;

export const OPTIONS: APIRoute = async ({ request }) => {
  const cors = getCorsHeaders(request);
  return new Response(null, {
    status: 204,
    headers: cors
  });
};

export const POST: APIRoute = async ({ request }) => {
  console.log('=== POST /api/enrich called ===');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);

  const apiSecret = import.meta.env.API_SECRET;

  const corsHeaders = {
    ...getCorsHeaders(request),
    'Content-Type': 'application/json'
  };

  if (!apiSecret) {
    console.error('API_SECRET not configured');
    return new Response(JSON.stringify({ error: 'API not configured' }), {
      status: 500,
      headers: corsHeaders
    });
  }

  const signature = request.headers.get('x-signature');
  const timestamp = request.headers.get('x-timestamp');
  const nonce = request.headers.get('x-nonce');

  if (!signature || !timestamp || !nonce) {
    return new Response(JSON.stringify({ error: 'Missing auth headers' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const now = Date.now();
  const ts = parseInt(timestamp);

  if (now - ts > 300000) {
    return new Response(JSON.stringify({ error: 'Request expired' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const body = await request.text();

  const isValid = await verifySignature(body, signature, apiSecret);

  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  try {
    const result = await enrichItemsLoop();

    console.log(`[3] Enrichment completed: ${result.processed} processed, ${result.remaining} remaining, batches: ${result.batches}, timedOut: ${result.timedOut}`);

    return new Response(JSON.stringify({
      success: true,
      processed: result.processed,
      remaining: result.remaining,
      completed: result.remaining === 0,
      batches: result.batches,
      timedOut: result.timedOut
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    console.error('[ERROR] Enrichment failed:', err);

    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    if (errorMsg.startsWith('RATE_LIMIT:')) {
      const waitMinutes = parseInt(errorMsg.split(':')[1] || '10');
      return new Response(JSON.stringify({
        success: false,
        error: 'RATE_LIMIT',
        waitMinutes,
        message: `GitHub API 速率限制，请等待 ${waitMinutes} 分钟后重试`
      }), {
        status: 429,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMsg
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
};

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = new Uint8Array(
    signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  return await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, data);
}

async function enrichItemsLoop(): Promise<{ processed: number; remaining: number; batches: number; timedOut: boolean }> {
  console.log('[enrichItemsLoop] Starting enrichment loop...');

  const githubToken = import.meta.env.GITHUB_TOKEN;
  const gistRawUrl = normalizeGistRawUrl(import.meta.env.GIST_RAW_URL || '');
  const gistId = extractGistIdFromRawUrl(gistRawUrl);

  if (!githubToken || !gistId) {
    throw new Error('Missing GITHUB_TOKEN or GIST_RAW_URL');
  }

  const TIME_BUDGET_MS = 4_500;
  const start = Date.now();

  let totalProcessed = 0;
  let batches = 0;
  let timedOut = false;

  const data = await fetchGistData(githubToken, gistId);

  if (!data || !data.items) {
    throw new Error('Failed to fetch gist data');
  }

  const BATCH_SIZE = 5;
  let remaining = 0;

  const countRemaining = () => data.items.filter((item: any) =>
    item.url &&
    item.url !== 'undefined' &&
    (!item.ai || !item.ai.enrichedAt) &&
    !(item.aiFailed && item.aiFailed.attempts >= MAX_FAIL_ATTEMPTS)
  ).length;

  while (true) {
    const unprocessedItems = data.items.filter((item: any) =>
      item.url &&
      item.url !== 'undefined' &&
      (!item.ai || !item.ai.enrichedAt) &&
      !(item.aiFailed && item.aiFailed.attempts >= MAX_FAIL_ATTEMPTS)
    );

    remaining = unprocessedItems.length;
    console.log(`[enrichItemsLoop] Remaining unprocessed: ${remaining}`);

    if (remaining === 0) break;

    const itemsToProcess = unprocessedItems.slice(0, BATCH_SIZE);

    console.log(`[enrichItemsLoop] Processing ${itemsToProcess.length} items (batch ${batches + 1})...`);

    const result = await enrichItems(itemsToProcess, data);

    if (result.changed) {
      console.log(`[enrichItemsLoop] Writing ${result.successCount} enriched items to gist...`);
      await updateGist(githubToken, gistId, data);
      console.log('[enrichItemsLoop] Gist updated successfully');
    }

    totalProcessed += result.successCount;
    batches += 1;

    remaining = countRemaining();

    if (Date.now() - start > TIME_BUDGET_MS) {
      timedOut = true;
      remaining = countRemaining();
      console.log('[enrichItemsLoop] Time budget reached, stopping early');
      break;
    }
  }

  return {
    processed: totalProcessed,
    remaining,
    batches,
    timedOut
  };
}

async function fetchGistData(githubToken: string, gistId: string): Promise<any> {
  console.log(`[fetchGistData] Fetching gist ${gistId}...`);

  const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Re:Mark-Extension'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!gistResponse.ok) {
    if (gistResponse.status === 403 || gistResponse.status === 429) {
      const resetHeader = gistResponse.headers.get('x-ratelimit-reset');
      const remaining = gistResponse.headers.get('x-ratelimit-remaining');

      console.error('[Rate Limit] GitHub API rate limit exceeded in fetchGistData', {
        status: gistResponse.status,
        remaining,
        reset: resetHeader
      });

      let waitMinutes = 10;
      if (resetHeader) {
        const resetTime = new Date(parseInt(resetHeader) * 1000);
        waitMinutes = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
      }

      throw new Error(`RATE_LIMIT:${waitMinutes}`);
    }

    throw new Error(`Failed to fetch gist: ${gistResponse.status}`);
  }

  const gist = await gistResponse.json();
  const file = gist.files['bookmarks.json'];

  if (!file) {
    throw new Error('bookmarks.json not found in gist');
  }

  let data;
  if (file.truncated) {
    console.log('[fetchGistData] File is truncated, fetching from raw_url...');
    const contentResponse = await fetch(file.raw_url, {
      signal: AbortSignal.timeout(15000)
    });
    const text = await contentResponse.text();
    data = safeParseJson(text, 'truncated raw_url');
  } else {
    data = safeParseJson(file.content, 'file.content');
  }

  console.log(`[fetchGistData] Loaded ${data.items?.length || 0} bookmarks`);
  return data;
}

async function updateGist(githubToken: string, gistId: string, data: any): Promise<void> {
  const updateResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json'
    },
    body: JSON.stringify({
      files: {
        'bookmarks.json': {
          content: JSON.stringify(data, null, 2)
        }
      }
    }),
    signal: AbortSignal.timeout(50000)
  });

  if (!updateResponse.ok) {
    throw new Error(`Failed to update gist: ${updateResponse.status}`);
  }
}

async function enrichItems(items: BookmarkItem[], data: any): Promise<EnrichResult> {
  console.log('[enrichItems] Function started');

  console.log('[enrichItems] Reading environment variables...');
  const aiApiKey = import.meta.env.AI_API_KEY;
  const aiApiUrl = import.meta.env.AI_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  const aiModel = import.meta.env.AI_MODEL || 'deepseek-chat';
  const jinaApiKey = import.meta.env.JINA_API_KEY;

  console.log('[enrichItems] Environment variables loaded:', {
    hasAiApiKey: !!aiApiKey,
    hasJinaApiKey: !!jinaApiKey
  });

  if (!aiApiKey) {
    console.error('[enrichItems] Missing AI_API_KEY');
    return { successCount: 0, failCount: 0, changed: false };
  }

  console.log('[enrichItems] All required env vars present, proceeding...');

  try {
    let successCount = 0;
    let failCount = 0;
    let changed = false;

    console.log(`[enrichItems] Starting concurrent processing of ${items.length} items...`);

    const BATCH_SIZE = 10;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      console.log(`[enrichItems] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(items.length/BATCH_SIZE)} (${batch.length} items)`);

      const batchPromises = batch.map(async (item) => {
        try {
          if (!item.url || item.url === 'undefined') {
            console.log(`Skipping ${item.id}: no valid URL`);
            return { success: false, itemId: item.id };
          }

          const content = await fetchContent(item.url, jinaApiKey);

          if (!content) {
            console.log(`No content for ${item.id}, will mark as failed`);
            const existingItem = data.items.find((i: any) => i.id === item.id);
            if (existingItem) {
              const attempts = (existingItem.aiFailed?.attempts ?? 0) + 1;
              existingItem.aiFailed = {
                reason: 'No content',
                attempts,
                failedAt: Date.now()
              };
              changed = true;
            }
            return { success: false, itemId: item.id };
          }

          const aiResult = await callAI({
            apiUrl: aiApiUrl,
            apiKey: aiApiKey,
            model: aiModel,
            originalTitle: item.title,
            url: item.url,
            content,
          });

          if (!aiResult.summary || !aiResult.tags || aiResult.tags.length === 0) {
            throw new Error('AI result missing summary or tags');
          }

          let cover: string | boolean = false;
          try {
            cover = await getFaviconUrl(item.url);

            if (!cover || cover === '') {
              cover = false;
            }
          } catch (err) {
            console.log(`Cover fetch failed for ${item.id}, setting to false`);
            cover = false;
          }

          const existingItem = data.items.find((i: any) => i.id === item.id);

          if (existingItem) {
            const optimizedTitle = aiResult.title || existingItem.title || item.title;
            existingItem.title = optimizedTitle;
            existingItem.ai = {
              title: aiResult.title || optimizedTitle,
              summary: aiResult.summary,
              tags: aiResult.tags,
              cover,
              enrichedAt: Date.now()
            };
            if (existingItem.aiFailed) {
              delete existingItem.aiFailed;
            }
            changed = true;
            console.log(`✓ ${item.id} (cover: ${cover !== false ? 'yes' : 'no'})`);
            return { success: true, itemId: item.id };
          }

          return { success: false, itemId: item.id };
        } catch (err) {
          console.error(`✗ ${item.id}:`, err instanceof Error ? err.message : 'Unknown error');
          const existingItem = data.items.find((i: any) => i.id === item.id);
          if (existingItem) {
            const attempts = (existingItem.aiFailed?.attempts ?? 0) + 1;
            existingItem.aiFailed = {
              reason: err instanceof Error ? err.message : 'Unknown error',
              attempts,
              failedAt: Date.now()
            };
            changed = true;
          }
          return { success: false, itemId: item.id };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const batchSuccess = batchResults.filter(r => r.success).length;
      const batchFailed = batchResults.filter(r => !r.success).length;

      successCount += batchSuccess;
      failCount += batchFailed;

      console.log(`[enrichItems] Batch complete: ${batchSuccess} success, ${batchFailed} failed`);
    }

    console.log(`[enrichItems] Enrichment complete: ${successCount} success, ${failCount} failed`);

    return { successCount, failCount, changed };
  } catch (err) {
    console.error('[enrichItems] Enrichment process error:', err);
    if (err instanceof Error) {
      console.error('[enrichItems] Error details:', err.message);
    }
    throw err;
  }
}

interface EnrichResult {
  successCount: number;
  failCount: number;
  changed: boolean;
}

function safeParseJson(text: string, label: string) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const snippet = text ? text.slice(0, 200) : '[empty]';
    throw new Error(`Failed to parse JSON (${label}): ${(err as Error).message}. Snippet: ${snippet}`);
  }
}

function getCorsHeaders(request: Request) {
  const reqHeaders = request.headers.get('access-control-request-headers');
  const allowHeaders = reqHeaders || 'Content-Type, x-signature, x-timestamp, x-nonce';

  const origin = request.headers.get('origin');

  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*',
    'Vary': 'Origin',
  };
}

function normalizeGistRawUrl(gistRawUrl: string): string {
  try {
    const url = new URL(gistRawUrl);
    if (url.hostname === 'gist.githubusercontent.com' || url.hostname === 'gist.github.com') {
      const segments = url.pathname.split('/').filter(Boolean);
      const rawIndex = segments.indexOf('raw');
      if (rawIndex !== -1) {
        const beforeRaw = segments.slice(0, rawIndex + 1);
        const afterRaw = segments.slice(rawIndex + 1);
        if (afterRaw.length >= 2) {
          afterRaw.shift();
        }
        url.pathname = '/' + [...beforeRaw, ...afterRaw].join('/');
        return url.toString();
      }
    }
  } catch (err) {
    console.error('Failed to normalize GIST_RAW_URL:', err instanceof Error ? err.message : String(err));
  }
  return gistRawUrl;
}

function extractGistIdFromRawUrl(gistRawUrl: string): string {
  try {
    const url = new URL(gistRawUrl);
    const segments = url.pathname.split('/').filter(Boolean);

    const hexLike = segments.find(seg => /^[0-9a-f]{16,40}$/i.test(seg));
    return hexLike || '';
  } catch (err) {
    console.error('Failed to parse GIST_RAW_URL:', err instanceof Error ? err.message : String(err));
    return '';
  }
}

async function fetchContent(url: string, jinaApiKey?: string): Promise<string> {
  try {
    if (!url || url === 'undefined') {
      console.error('Invalid URL provided to fetchContent');
      return '';
    }

    console.log(`[fetchContent] Starting fetch for: ${url}`);

    console.log(`[fetchContent] Step 1: Direct fetch`);
    try {
      const directRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ReMarkBot/1.0; +https://github.com/yourusername/remark)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (directRes.ok) {
        const contentType = directRes.headers.get('content-type') || '';

        if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
          const html = await directRes.text();

          const cleanText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (cleanText.length > 100) {
            console.log(`[fetchContent] ✅ Direct fetch success (${cleanText.length} chars)`);
            return cleanText.slice(0, 2000);
          }
        }
      }
      console.log(`[fetchContent] Direct fetch failed: ${directRes.status}`);
    } catch (directErr) {
      console.log(`[fetchContent] Direct fetch error: ${directErr instanceof Error ? directErr.message : 'Unknown'}`);
    }

    console.log(`[fetchContent] Step 2: Jina Reader`);

    const fetchFromJina = async (targetUrl: string, useAuth: boolean, timeout: number) => {
      const headers: Record<string, string> = { 'Accept': 'text/plain' };
      if (useAuth && jinaApiKey) {
        headers['Authorization'] = `Bearer ${jinaApiKey}`;
      }

      const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
        headers,
        signal: AbortSignal.timeout(timeout),
      });
      return res;
    };

    const targets: string[] = [url];
    try {
      const parsed = new URL(url);
      if (parsed.pathname && parsed.pathname !== '/') {
        targets.push(`${parsed.protocol}//${parsed.hostname}`);
      }
    } catch {
    }

    for (const target of targets.slice(0, 2)) {
      if (jinaApiKey) {
        try {
          console.log(`[fetchContent] Trying Jina (auth) for: ${target}`);
          const res = await fetchFromJina(target, true, 6000);
          if (res.ok) {
            const text = await res.text();
            if (text.length > 50) {
              console.log(`[fetchContent] ✅ Jina (auth) success (${text.length} chars)`);
              return text.slice(0, 2000);
            }
          }
          console.log(`[fetchContent] Jina (auth) failed: ${res.status}`);
        } catch (jinaAuthErr) {
          console.log(`[fetchContent] Jina (auth) error: ${jinaAuthErr instanceof Error ? jinaAuthErr.message : 'Unknown'}`);
        }
      }

      try {
        console.log(`[fetchContent] Trying Jina (free) for: ${target}`);
        const freeRes = await fetchFromJina(target, false, 6000);
        if (freeRes.ok) {
          const text = await freeRes.text();
          if (text.length > 50) {
            console.log(`[fetchContent] ✅ Jina (free) success (${text.length} chars)`);
            return text.slice(0, 2000);
          }
        }
        console.log(`[fetchContent] Jina (free) failed: ${freeRes.status}`);
      } catch (jinaFreeErr) {
        console.log(`[fetchContent] Jina (free) error: ${jinaFreeErr instanceof Error ? jinaFreeErr.message : 'Unknown'}`);
      }
    }

    console.warn(`[fetchContent] ❌ All strategies failed for ${url}, skipping`);
    return '';
  } catch (err) {
    console.error(`[fetchContent] Unexpected error for ${url}:`, err instanceof Error ? err.message : String(err));
    return '';
  }
}

interface AiPayload {
  apiUrl: string;
  apiKey: string;
  model: string;
  originalTitle: string;
  url: string;
  content: string;
}

async function callAI({ apiUrl, apiKey, model, originalTitle, url, content }: AiPayload): Promise<{ title: string; summary: string; tags: string[] }> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: buildBookmarkEnrichmentPrompt({
          url,
          originalTitle,
          content
        })
      }],
      temperature: 0.3,
      max_tokens: 150
    }),
    signal: AbortSignal.timeout(40000)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new Error(`AI API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  let aiText = result.choices[0].message.content;

  aiText = aiText.trim();
  if (aiText.startsWith('```json')) {
    aiText = aiText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (aiText.startsWith('```')) {
    aiText = aiText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(aiText);
  return {
    title: parsed.title || originalTitle,
    summary: parsed.summary || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : []
  };
}

async function getFaviconUrl(url: string): Promise<string> {
  try {
    if (!url || url === 'undefined') {
      return '';
    }

    const domain = new URL(url).hostname;

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (err) {
    console.error(`getFaviconUrl failed for ${url}:`, err instanceof Error ? err.message : String(err));
    return '';
  }
}
