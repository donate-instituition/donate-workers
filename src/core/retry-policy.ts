export type RetryPolicy = {
  initialDelayMs: number;
  jitterRatio: number;
  maxAttempts: number;
  maxDelayMs: number;
  multiplier: number;
};

export function calculateBackoffDelay(attempt: number, retryPolicy: RetryPolicy) {
  const baseDelay =
    retryPolicy.initialDelayMs *
    retryPolicy.multiplier ** Math.max(attempt - 1, 0);
  const cappedDelay = Math.min(baseDelay, retryPolicy.maxDelayMs);
  const jitter = cappedDelay * retryPolicy.jitterRatio;
  const minDelay = Math.max(cappedDelay - jitter, 0);
  const maxDelay = cappedDelay + jitter;

  return Math.round(minDelay + Math.random() * (maxDelay - minDelay));
}

export function shouldRetry(attempt: number, retryPolicy: RetryPolicy) {
  return attempt < retryPolicy.maxAttempts;
}
