import type { BookmarkItem, SyncData } from '../types';

export async function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return browser.bookmarks.getTree();
}

export async function flattenBookmarks(tree: chrome.bookmarks.BookmarkTreeNode[]): Promise<BookmarkItem[]> {
  const items: BookmarkItem[] = [];
  let order = 0;

  async function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[], parentId?: string) {
    for (const node of nodes) {
      const id = await generateStableId(node);
      items.push({
        id,
        parentId,
        title: node.title,
        url: node.url,
        order: order++,
        createdAt: node.dateAdded || Date.now()
      });
      if (node.children) await traverse(node.children, id);
    }
  }

  if (tree[0]?.children) await traverse(tree[0].children);
  return items;
}

export async function buildBookmarkTree(items: BookmarkItem[]): Promise<void> {
  const itemMap = new Map<string, BookmarkItem>();
  items.forEach(item => itemMap.set(item.id, item));

  const rootItems = items.filter(item => !item.parentId).sort((a, b) => a.order - b.order);

  for (const item of rootItems) {
    const targetRootId = resolveRootId(item.title) || '1';
    if (item.url) {
      await createNode(item, targetRootId, itemMap);
    } else {
      await createChildren(targetRootId, item.id, itemMap);
    }
  }
}

async function createNode(item: BookmarkItem, parentId: string, itemMap: Map<string, BookmarkItem>): Promise<string> {
  try {
    const node = await browser.bookmarks.create({
      parentId,
      title: item.title,
      url: item.url
    });

    const children = getChildren(itemMap, item.id);
    for (const child of children) {
      await createNode(child, node.id!, itemMap);
    }

    return node.id!;
  } catch {
    return '';
  }
}

async function createChildren(parentId: string, parentItemId: string, itemMap: Map<string, BookmarkItem>) {
  const children = getChildren(itemMap, parentItemId);
  for (const child of children) {
    await createNode(child, parentId, itemMap);
  }
}

export async function clearAllBookmarks(): Promise<void> {
  const tree = await getBookmarkTree();

  if (tree[0]?.children) {
    for (const root of tree[0].children) {
      if (root.children) {
        for (const node of root.children) {
          if (node.id) {
            try {
              await browser.bookmarks.removeTree(node.id);
            } catch {}
          }
        }
      }
    }
  }
}

export function countBookmarks(items: BookmarkItem[]): number {
  return items.filter(item => item.url).length;
}

function getChildren(itemMap: Map<string, BookmarkItem>, parentId: string) {
  return Array.from(itemMap.values())
    .filter(i => i.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

function resolveRootId(title: string): string | null {
  const t = title.trim().toLowerCase();
  const mapping: Record<string, string> = {
    'bookmarks bar': '1',
    'bookmark bar': '1',
    'bookmark toolbar': '1',
    '书签栏': '1',
    'other bookmarks': '2',
    '其他书签': '2',
    'mobile bookmarks': '3',
    '移动书签': '3'
  };
  return mapping[t] || null;
}

async function generateStableId(node: chrome.bookmarks.BookmarkTreeNode): Promise<string> {
  const content = `${node.title}::${node.url || 'folder'}::${node.dateAdded || 0}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
