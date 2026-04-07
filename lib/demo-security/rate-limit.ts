export interface RateLimitStoreEntry {
  count: number;
  resetAt: number;
}

export type RateLimitStore = Map<string, RateLimitStoreEntry>;

export function createRateLimitStore(): RateLimitStore {
  return new Map();
}

export function consumeRateLimit(input: {
  store: RateLimitStore;
  key: string;
  now: number;
  maxRequests: number;
  windowMs: number;
}) {
  const existing = input.store.get(input.key);

  if (!existing || existing.resetAt <= input.now) {
    input.store.set(input.key, {
      count: 1,
      resetAt: input.now + input.windowMs
    });

    return {
      allowed: true,
      remaining: Math.max(input.maxRequests - 1, 0),
      retryAfterMs: input.windowMs
    };
  }

  if (existing.count >= input.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(existing.resetAt - input.now, 0)
    };
  }

  existing.count += 1;
  input.store.set(input.key, existing);

  return {
    allowed: true,
    remaining: Math.max(input.maxRequests - existing.count, 0),
    retryAfterMs: Math.max(existing.resetAt - input.now, 0)
  };
}
