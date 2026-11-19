export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export interface IRateLimiter {
  consume(key: string, maxRequests: number, windowMs: number): RateLimitResult;
  acquireLock(lockKey: string): boolean;
  releaseLock(lockKey: string): void;
}
