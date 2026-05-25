export type EnrichJobStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export interface EnrichJobState {
  state: EnrichJobStatus;
  processed: number;
  remaining: number;
  attempt: number;
  startedAt: number;
  updatedAt: number;
  nextRunAt?: number;
  lastError?: string;
  noProgressSteps?: number;
}

export interface EnrichStepResult {
  processed?: number;
  remaining?: number;
  readyRemaining?: number;
  completed?: boolean;
  retryDelayMs?: number;
  timedOut?: boolean;
}

export type EnrichJobStepContinuation = 'continue' | 'restart' | 'stop';

const BASE_RETRY_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 600_000;

export function createEnrichJob(now: number): EnrichJobState {
  return {
    state: 'running',
    processed: 0,
    remaining: 0,
    attempt: 0,
    startedAt: now,
    updatedAt: now
  };
}

export function startEnrichJobStep(job: EnrichJobState, now: number): EnrichJobState {
  return {
    ...job,
    state: 'running',
    updatedAt: now,
    nextRunAt: undefined,
    lastError: undefined
  };
}

export function finishEnrichJobStep(
  job: EnrichJobState,
  result: EnrichStepResult,
  now: number,
  nextDelayMs: number
): EnrichJobState {
  const remaining = result.remaining ?? job.remaining;
  const completed = !!result.completed || remaining === 0;
  const processed = result.processed ?? 0;
  const madeProgress = processed > 0 || remaining < job.remaining;
  const noProgressSteps = completed || madeProgress ? undefined : (job.noProgressSteps ?? 0) + 1;

  return {
    state: completed ? 'completed' : 'running',
    processed: job.processed + processed,
    remaining,
    attempt: job.attempt + 1,
    startedAt: job.startedAt,
    updatedAt: now,
    nextRunAt: completed ? undefined : now + nextDelayMs,
    lastError: undefined,
    noProgressSteps
  };
}

export function failEnrichJobStep(job: EnrichJobState, error: string, now: number): EnrichJobState {
  const attempt = job.attempt + 1;
  const retryDelay = Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt - 2), MAX_RETRY_DELAY_MS);

  return {
    ...job,
    state: 'paused',
    attempt,
    updatedAt: now,
    nextRunAt: now + retryDelay,
    lastError: error
  };
}

export function getNextEnrichStepDelayMs(result: EnrichStepResult, fallbackDelayMs: number): number | undefined {
  const remaining = result.remaining ?? 0;
  if (result.completed || remaining === 0) return undefined;
  if ((result.readyRemaining ?? 0) > 0) return 0;
  if (result.retryDelayMs !== undefined) return result.retryDelayMs;
  if (result.timedOut || (result.processed ?? 0) > 0) return 0;
  return fallbackDelayMs;
}

export function stopEnrichJob(job: EnrichJobState, now: number): EnrichJobState {
  return {
    ...job,
    state: 'idle',
    updatedAt: now,
    nextRunAt: undefined,
    lastError: undefined
  };
}

export function resolveEnrichJobStepContinuation(
  startedJob: EnrichJobState,
  currentJob: EnrichJobState | null
): EnrichJobStepContinuation {
  if (!currentJob || currentJob.state === 'idle' || currentJob.state === 'completed' || currentJob.state === 'failed') {
    return 'stop';
  }

  if (currentJob.startedAt !== startedJob.startedAt) {
    return 'restart';
  }

  return 'continue';
}
