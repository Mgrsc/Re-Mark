import { describe, expect, it } from 'bun:test';
import { normalizeGeneratedTitle, shouldApplyGeneratedTitle } from './titleCleaner';

describe('normalizeGeneratedTitle', () => {
  it('keeps concise generated titles', () => {
    expect(normalizeGeneratedTitle('  Cloudflare 控制台  ')).toBe('Cloudflare 控制台');
  });

  it('removes surrounding quotes and repeated separators', () => {
    expect(normalizeGeneratedTitle('"Google AI Studio | Doctor Portrait Generation"')).toBe('Google AI Studio · Doctor Portrait Generation');
  });

  it('limits overly long generated titles', () => {
    expect(normalizeGeneratedTitle('Eigen AI - High-performance Fine-tuning and Inference Platform for Developers')).toBe('Eigen AI · High-performance Fine-tuning and Inference');
  });
});

describe('shouldApplyGeneratedTitle', () => {
  it('applies shorter meaningful titles', () => {
    expect(shouldApplyGeneratedTitle('帐户主页 | user@example.com Account | Cloudflare', 'Cloudflare 控制台')).toBe(true);
  });

  it('skips unchanged titles', () => {
    expect(shouldApplyGeneratedTitle('AWS 云服务', 'AWS 云服务')).toBe(false);
  });

  it('skips empty generated titles', () => {
    expect(shouldApplyGeneratedTitle('AWS 云服务', '')).toBe(false);
  });
});
