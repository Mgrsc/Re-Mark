const TRACKING_PARAMS = new Set([
  'fbclid',
  'gad_source',
  'gclid',
  'gbraid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'ref',
  'spm',
  'wbraid',
  'yclid'
]);

export function canonicalizeBookmarkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const retained = Array.from(parsed.searchParams.entries())
      .filter(([key]) => !isTrackingParam(key))
      .sort(([a], [b]) => a.localeCompare(b));

    parsed.search = '';
    for (const [key, value] of retained) {
      parsed.searchParams.append(key, value);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildTitleCleanupFingerprint(title: string, url?: string): string {
  return `${normalizeFingerprintValue(title)}::${url ? canonicalizeBookmarkUrl(url) : ''}`;
}

export function buildEnrichmentFingerprint(title: string, url?: string): string {
  return buildTitleCleanupFingerprint(title, url);
}

function isTrackingParam(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith('utm_') || TRACKING_PARAMS.has(normalized);
}

function normalizeFingerprintValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
