/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-instance deployments (e.g. Vercel Hobby / single
 * serverless function). State is not shared across instances.
 *
 * The store is a Map from rate-limit key to an array of timestamps (ms)
 * representing when each request arrived. Entries outside the current window
 * are discarded on every check to prevent unbounded memory growth.
 */

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms when the oldest in-window request falls out
};

// Module-level store — shared across all calls within one process lifetime.
const store = new Map<string, number[]>();

/**
 * Check whether a request identified by `key` is within the allowed rate.
 *
 * @param key       Unique identifier (e.g. `"<route>:<ip>"`).
 * @param limit     Maximum number of requests allowed per window.
 * @param windowMs  Window length in milliseconds.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Retrieve existing timestamps and prune those outside the window.
  const raw = store.get(key) ?? [];
  const timestamps = raw.filter((ts) => ts > windowStart);

  const remaining = Math.max(0, limit - timestamps.length - 1);
  const resetAt =
    timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

  if (timestamps.length >= limit) {
    // Do not record this request — it is rejected.
    store.set(key, timestamps);
    return { allowed: false, remaining: 0, resetAt };
  }

  // Record the new request timestamp.
  store.set(key, [...timestamps, now]);
  return { allowed: true, remaining, resetAt };
}

/**
 * Derive a rate-limit key from a Request.
 * Falls back to "unknown" when no IP can be determined.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; use the first entry.
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}
