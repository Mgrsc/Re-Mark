import { describe, expect, it } from 'bun:test';
import { canonicalizeBookmarkUrl } from './canonicalUrl';

describe('canonicalizeBookmarkUrl', () => {
  it('removes common tracking parameters without changing the real URL', () => {
    expect(canonicalizeBookmarkUrl('https://example.com/path?utm_source=google&gclid=abc&query=keep#section')).toBe('https://example.com/path?query=keep#section');
  });

  it('sorts retained parameters for stable matching', () => {
    expect(canonicalizeBookmarkUrl('https://example.com/search?b=2&a=1&utm_medium=cpc')).toBe('https://example.com/search?a=1&b=2');
  });

  it('returns invalid URLs unchanged', () => {
    expect(canonicalizeBookmarkUrl('not a url')).toBe('not a url');
  });
});
