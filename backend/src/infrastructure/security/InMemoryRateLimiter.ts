import { IRateLimiter, RateLimitResult } from '../../application/ports/services/IRateLimiter';

export class InMemoryRateLimiter implements IRateLimiter {
  private readonly timestamps = new Map<string, number[]>();
  private readonly activeLocks = new Set<string>();

  public consume(key: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;
    const recent = (this.timestamps.get(key) ?? []).filter((ts) => ts > windowStart);

    if (recent.length >= maxRequests) {
      const oldestInWindow = recent[0] ?? now;
      const retryAfterMs = Math.max(1000, oldestInWindow + windowMs - now);
      this.timestamps.set(key, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
      };
    }

    recent.push(now);
    this.timestamps.set(key, recent);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, maxRequests - recent.length),
    };
  }

  public acquireLock(lockKey: string): boolean {
    if (this.activeLocks.has(lockKey)) {
      return false;
    }
    this.activeLocks.add(lockKey);
    return true;
  }

  public releaseLock(lockKey: string): void {
    this.activeLocks.delete(lockKey);
  }
}
