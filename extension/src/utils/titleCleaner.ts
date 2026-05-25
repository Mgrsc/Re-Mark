const MAX_TITLE_LENGTH = 56;

export function normalizeGeneratedTitle(title: string): string {
  const cleaned = title
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .replace(/\s*[|｜]\s*/g, ' · ')
    .replace(/\s+[-–—]\s+/g, ' · ')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*·\s*){2,}/g, ' · ')
    .trim();

  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;

  const parts = cleaned.split(' · ').map(part => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const kept: string[] = [];
    for (const part of parts) {
      const next = [...kept, part].join(' · ');
      if (next.length > MAX_TITLE_LENGTH) break;
      kept.push(part);
    }
    const [first, second] = parts;
    if (kept.length === 1 && first && second) {
      const separator = ' · ';
      const available = MAX_TITLE_LENGTH - first.length - separator.length;
      if (available > 12) return `${first}${separator}${truncateAtWordBoundary(second, available)}`;
    }
    if (kept.length > 0) return kept.join(' · ');
  }

  return cleaned.slice(0, MAX_TITLE_LENGTH).trim();
}

export function shouldApplyGeneratedTitle(currentTitle: string, generatedTitle: string): boolean {
  const current = normalizeComparableTitle(currentTitle);
  const generated = normalizeComparableTitle(normalizeGeneratedTitle(generatedTitle));
  if (!generated || current === generated) return false;
  if (generated.length <= current.length) return true;
  return current.length > MAX_TITLE_LENGTH && generated.length < current.length;
}

function normalizeComparableTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sliced = value.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace <= 12) return sliced;
  return sliced.slice(0, lastSpace).trim();
}
