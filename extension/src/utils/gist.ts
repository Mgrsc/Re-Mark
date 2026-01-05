import type { SyncData } from '../types';

export async function createGist(token: string): Promise<string> {
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      description: 'Re:Mark Bookmarks',
      public: false,
      files: {
        'bookmarks.json': {
          content: JSON.stringify({
            version: '1.0.0',
            updatedAt: Date.now(),
            browser: navigator.userAgent,
            items: []
          }, null, 2)
        }
      }
    })
  });

  if (!response.ok) throw new Error(`Gist creation failed: ${response.status}`);

  const gist = await response.json();
  return gist.id;
}

export async function fetchGist(token: string, gistId: string): Promise<SyncData | null> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) throw new Error(`Gist fetch failed: ${response.status}`);

  const gist = await response.json();
  const file = gist.files['bookmarks.json'];

  if (!file) return null;

  if (file.truncated) {
    const contentResponse = await fetch(file.raw_url, { cache: 'no-store' });
    const content = await contentResponse.text();
    return JSON.parse(content);
  }

  return JSON.parse(file.content);
}

export async function updateGist(token: string, gistId: string, data: SyncData): Promise<void> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      files: {
        'bookmarks.json': {
          content: JSON.stringify(data, null, 2)
        }
      }
    })
  });

  if (!response.ok) throw new Error(`Gist update failed: ${response.status}`);
}
