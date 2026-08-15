// In-memory port of the BNI RollCall project's src/lib/rateLimit.ts (Redis INCR/EXPIRE fixed-
// window counter). This app runs a single Node process (pm2, one instance), so a shared/
// distributed limiter isn't needed — a plain in-process Map is equivalent and adds no
// infrastructure dependency.

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

/// Fixed-window counter: allows up to `limit` calls per `windowSeconds` for a given key.
/// Returns true if this call is allowed (and counts it).
export function checkRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = counters.get(key);

  if (!existing || existing.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  existing.count += 1;
  return existing.count <= limit;
}
