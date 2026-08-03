import { calculateBackoffDelay, shouldRetry } from './retry-policy';

describe('retry policy', () => {
  it('returns true until max attempts is reached', () => {
    const retryPolicy = {
      initialDelayMs: 100,
      jitterRatio: 0,
      maxAttempts: 3,
      maxDelayMs: 250,
      multiplier: 2,
    };

    expect(shouldRetry(1, retryPolicy)).toBe(true);
    expect(shouldRetry(2, retryPolicy)).toBe(true);
    expect(shouldRetry(3, retryPolicy)).toBe(false);
  });

  it('applies exponential backoff with cap', () => {
    const retryPolicy = {
      initialDelayMs: 100,
      jitterRatio: 0,
      maxAttempts: 3,
      maxDelayMs: 250,
      multiplier: 2,
    };

    expect(calculateBackoffDelay(1, retryPolicy)).toBe(100);
    expect(calculateBackoffDelay(2, retryPolicy)).toBe(200);
    expect(calculateBackoffDelay(3, retryPolicy)).toBe(250);
  });
});
