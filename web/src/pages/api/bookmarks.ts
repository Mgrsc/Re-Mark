import type { APIRoute } from 'astro';

export const prerender = false;

function getCorsHeaders(request?: Request) {
  const origin = request?.headers.get('origin');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*',
  };

  if (origin) {
    headers['Vary'] = 'Origin';
  }

  return headers;
}

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
};

export const GET: APIRoute = async ({ request }) => {
  const corsHeaders = {
    ...getCorsHeaders(request),
    'Content-Type': 'application/json'
  };

  try {
    const githubToken = import.meta.env.GITHUB_TOKEN;
    const rawGistUrl = import.meta.env.GIST_RAW_URL || '';

    if (!rawGistUrl) {
      return new Response(JSON.stringify({ error: 'GIST_RAW_URL not configured' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const gistRawUrl = normalizeGistRawUrl(rawGistUrl);
    const gistId = extractGistIdFromRawUrl(gistRawUrl);

    if (!gistId) {
      return new Response(JSON.stringify({ error: 'Invalid GIST_RAW_URL' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    if (githubToken) {
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

          console.error('[Rate Limit] GitHub API rate limit exceeded', {
            status: gistResponse.status,
            remaining,
            reset: resetHeader
          });

          let waitMinutes = 10;
          if (resetHeader) {
            const resetTime = new Date(parseInt(resetHeader) * 1000);
            waitMinutes = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
          }

          return new Response(JSON.stringify({
            error: 'RATE_LIMIT',
            waitMinutes,
            message: `GitHub API 速率限制，请等待 ${waitMinutes} 分钟后重试`
          }), {
            status: 429,
            headers: corsHeaders
          });
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
        const contentResponse = await fetch(file.raw_url, {
          signal: AbortSignal.timeout(15000)
        });
        data = await contentResponse.json();
      } else {
        data = JSON.parse(file.content);
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      const response = await fetch(gistRawUrl, {
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          const resetHeader = response.headers.get('x-ratelimit-reset');

          console.error('[Rate Limit] GitHub raw URL rate limit exceeded', {
            status: response.status,
            reset: resetHeader
          });

          let waitMinutes = 10;
          if (resetHeader) {
            const resetTime = new Date(parseInt(resetHeader) * 1000);
            waitMinutes = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
          }

          return new Response(JSON.stringify({
            error: 'RATE_LIMIT',
            waitMinutes,
            message: `GitHub 速率限制，请等待 ${waitMinutes} 分钟后重试`
          }), {
            status: 429,
            headers: corsHeaders
          });
        }

        throw new Error(`Failed to fetch gist: ${response.status}`);
      }

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  } catch (err) {
    console.error('[/api/bookmarks] Error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
};

function normalizeGistRawUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'gist.githubusercontent.com' || parsed.hostname === 'gist.github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const rawIndex = parts.indexOf('raw');
      if (rawIndex !== -1) {
        const beforeRaw = parts.slice(0, rawIndex + 1);
        const afterRaw = parts.slice(rawIndex + 1);
        if (afterRaw.length >= 2) {
          afterRaw.shift();
        }
        parsed.pathname = '/' + [...beforeRaw, ...afterRaw].join('/');
        return parsed.toString();
      }
    }
  } catch (e) {}
  return url;
}

function extractGistIdFromRawUrl(gistRawUrl: string): string {
  try {
    const url = new URL(gistRawUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const hexLike = segments.find(seg => /^[0-9a-f]{16,40}$/i.test(seg));
    return hexLike || '';
  } catch (err) {
    return '';
  }
}
