import { generateSignature } from './crypto';

type EnrichResponse = {
  success?: boolean;
  processed?: number;
  remaining?: number;
  completed?: boolean;
  batches?: number;
  timedOut?: boolean;
};

async function callEnrichAPI(webUrl: string, apiSecret: string): Promise<EnrichResponse> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify({});
  const signature = await generateSignature(payload, apiSecret);

  const response = await fetch(`${webUrl}/api/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature,
      'x-timestamp': timestamp,
      'x-nonce': nonce
    },
    body: payload
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as EnrichResponse;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runEnrichUntilDone(
  webUrl: string,
  apiSecret: string,
  onProgress?: (res: EnrichResponse, attempt: number) => void
): Promise<EnrichResponse> {
  let attempt = 0;
  let lastResult: EnrichResponse = {};
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;
  let noProgressCount = 0;
  const maxNoProgress = 3;
  let lastRemaining: number | undefined;

  while (true) {
    try {
      attempt += 1;
      lastResult = await callEnrichAPI(webUrl, apiSecret);
      consecutiveErrors = 0;
      onProgress?.(lastResult, attempt);

      if (typeof lastRemaining === 'number' && lastResult.remaining === lastRemaining) {
        noProgressCount += 1;
      } else {
        noProgressCount = 0;
      }
      lastRemaining = lastResult.remaining;

      if (noProgressCount >= maxNoProgress) {
        return { ...lastResult, success: false, timedOut: true, completed: false };
      }

      if (lastResult.completed || lastResult.remaining === 0) return lastResult;
    } catch (err) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= maxConsecutiveErrors) throw err;
      onProgress?.({ timedOut: true }, attempt);
    }

    await sleep(2000);
  }
}
