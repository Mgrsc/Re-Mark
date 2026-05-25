import { describe, expect, it } from 'bun:test';
import {
  createEnrichJob,
  failEnrichJobStep,
  finishEnrichJobStep,
  getNextEnrichStepDelayMs,
  resolveEnrichJobStepContinuation,
  startEnrichJobStep,
  stopEnrichJob,
  type EnrichJobState
} from './enrichJob';

describe('createEnrichJob', () => {
  it('starts a running job with empty progress', () => {
    expect(createEnrichJob(1000)).toEqual({
      state: 'running',
      processed: 0,
      remaining: 0,
      attempt: 0,
      startedAt: 1000,
      updatedAt: 1000
    });
  });
});

describe('startEnrichJobStep', () => {
  it('marks a running job as active for the next step', () => {
    const job = createEnrichJob(1000);

    expect(startEnrichJobStep(job, 2000)).toEqual({
      ...job,
      state: 'running',
      updatedAt: 2000,
      nextRunAt: undefined,
      lastError: undefined
    });
  });
});

describe('finishEnrichJobStep', () => {
  it('schedules another step when remaining bookmarks exist', () => {
    const job = createEnrichJob(1000);

    expect(finishEnrichJobStep(job, { processed: 5, remaining: 10, completed: false }, 2000, 3000)).toEqual({
      state: 'running',
      processed: 5,
      remaining: 10,
      attempt: 1,
      startedAt: 1000,
      updatedAt: 2000,
      nextRunAt: 5000,
      lastError: undefined
    });
  });

  it('completes the job when no bookmarks remain', () => {
    const job = createEnrichJob(1000);

    expect(finishEnrichJobStep(job, { processed: 5, remaining: 0, completed: true }, 2000, 3000)).toEqual({
      state: 'completed',
      processed: 5,
      remaining: 0,
      attempt: 1,
      startedAt: 1000,
      updatedAt: 2000,
      nextRunAt: undefined,
      lastError: undefined
    });
  });

  it('accumulates processed counts across steps', () => {
    const job: EnrichJobState = {
      state: 'running',
      processed: 8,
      remaining: 20,
      attempt: 2,
      startedAt: 1000,
      updatedAt: 2000
    };

    expect(finishEnrichJobStep(job, { processed: 4, remaining: 16, completed: false }, 3000, 5000).processed).toBe(12);
  });

  it('tracks consecutive steps without progress', () => {
    const job: EnrichJobState = {
      state: 'running',
      processed: 0,
      remaining: 20,
      attempt: 1,
      startedAt: 1000,
      updatedAt: 2000,
      noProgressSteps: 1
    };

    expect(finishEnrichJobStep(job, { processed: 0, remaining: 20, completed: false }, 3000, 5000).noProgressSteps).toBe(2);
  });

  it('clears no-progress tracking after a successful step', () => {
    const job: EnrichJobState = {
      state: 'running',
      processed: 0,
      remaining: 20,
      attempt: 1,
      startedAt: 1000,
      updatedAt: 2000,
      noProgressSteps: 2
    };

    expect(finishEnrichJobStep(job, { processed: 3, remaining: 17, completed: false }, 3000, 5000).noProgressSteps).toBeUndefined();
  });
});

describe('failEnrichJobStep', () => {
  it('pauses failed jobs with bounded exponential retry delay', () => {
    const job: EnrichJobState = {
      state: 'running',
      processed: 0,
      remaining: 25,
      attempt: 4,
      startedAt: 1000,
      updatedAt: 2000
    };

    expect(failEnrichJobStep(job, 'Network offline', 3000)).toEqual({
      state: 'paused',
      processed: 0,
      remaining: 25,
      attempt: 5,
      startedAt: 1000,
      updatedAt: 3000,
      nextRunAt: 123000,
      lastError: 'Network offline'
    });
  });

  it('caps retry delay', () => {
    const job: EnrichJobState = {
      state: 'running',
      processed: 0,
      remaining: 25,
      attempt: 20,
      startedAt: 1000,
      updatedAt: 2000
    };

    expect(failEnrichJobStep(job, 'Network offline', 3000).nextRunAt).toBe(603000);
  });
});

describe('getNextEnrichStepDelayMs', () => {
  it('continues immediately when ready bookmarks remain', () => {
    expect(getNextEnrichStepDelayMs({ processed: 10, remaining: 15, readyRemaining: 5 }, 30000)).toBe(0);
  });

  it('waits for retry backoff when only deferred bookmarks remain', () => {
    expect(getNextEnrichStepDelayMs({ processed: 1, remaining: 1, readyRemaining: 0, retryDelayMs: 15000 }, 30000)).toBe(15000);
  });

  it('does not schedule another step when processing is complete', () => {
    expect(getNextEnrichStepDelayMs({ processed: 10, remaining: 0, completed: true }, 30000)).toBeUndefined();
  });
});

describe('stopEnrichJob', () => {
  it('stops a running job without clearing progress', () => {
    const job: EnrichJobState = {
      state: 'running',
      processed: 4,
      remaining: 8,
      attempt: 1,
      startedAt: 1000,
      updatedAt: 2000,
      nextRunAt: 5000
    };

    expect(stopEnrichJob(job, 3000)).toEqual({
      state: 'idle',
      processed: 4,
      remaining: 8,
      attempt: 1,
      startedAt: 1000,
      updatedAt: 3000,
      nextRunAt: undefined,
      lastError: undefined
    });
  });
});

describe('resolveEnrichJobStepContinuation', () => {
  it('continues when the active job is unchanged', () => {
    const job = createEnrichJob(1000);

    expect(resolveEnrichJobStepContinuation(job, job)).toBe('continue');
  });

  it('stops when the user stopped the active job', () => {
    const job = createEnrichJob(1000);

    expect(resolveEnrichJobStepContinuation(job, stopEnrichJob(job, 2000))).toBe('stop');
  });

  it('restarts when a newer job was created while a step was finishing', () => {
    const job = createEnrichJob(1000);
    const newerJob = createEnrichJob(2000);

    expect(resolveEnrichJobStepContinuation(job, newerJob)).toBe('restart');
  });
});
