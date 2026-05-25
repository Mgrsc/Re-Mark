import { describe, expect, it } from 'bun:test';
import type { EnrichJobState } from './enrichJob';
import { getEnrichStatusText } from './enrichStatus';

const labels = {
  running: (processed: number, remaining: number) => `running ${processed}/${remaining}`,
  paused: (remaining: number) => `paused ${remaining}`,
  completed: (processed: number) => `completed ${processed}`,
  failed: 'failed'
};

function job(state: EnrichJobState['state'], processed = 0): EnrichJobState {
  return {
    state,
    processed,
    remaining: 0,
    attempt: 1,
    startedAt: 1000,
    updatedAt: 1000
  };
}

describe('getEnrichStatusText', () => {
  it('hides completed jobs with no processed bookmarks', () => {
    expect(getEnrichStatusText(job('completed', 0), labels)).toBe('');
  });

  it('shows completed jobs with processed bookmarks', () => {
    expect(getEnrichStatusText(job('completed', 3), labels)).toBe('completed 3');
  });
});
