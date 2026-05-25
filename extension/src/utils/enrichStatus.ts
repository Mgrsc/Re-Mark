import type { EnrichJobState } from './enrichJob';

interface EnrichStatusLabels {
  running: (processed: number, remaining: number) => string;
  paused: (remaining: number) => string;
  completed: (processed: number) => string;
  failed: string;
}

export function getEnrichStatusText(job: EnrichJobState | null, labels: EnrichStatusLabels): string {
  if (!job || job.state === 'idle') return '';
  if (job.state === 'running') return labels.running(job.processed, job.remaining);
  if (job.state === 'paused') return labels.paused(job.remaining);
  if (job.state === 'completed') return job.processed > 0 ? labels.completed(job.processed) : '';
  return job.lastError ? `${labels.failed}: ${job.lastError}` : labels.failed;
}
