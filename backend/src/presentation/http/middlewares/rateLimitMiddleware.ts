import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

export interface AuthRateLimitOptions {
  loginMax?: number;
  loginWindowMs?: number;
  registerMax?: number;
  registerWindowMs?: number;
  refreshMax?: number;
  refreshWindowMs?: number;
}

export interface AuthRateLimiters {
  loginLimiter: RateLimitRequestHandler;
  registerLimiter: RateLimitRequestHandler;
  refreshLimiter: RateLimitRequestHandler;
}

export function createAuthRateLimiters(options: AuthRateLimitOptions = {}): AuthRateLimiters {
  const loginLimiter = rateLimit({
    windowMs: options.loginWindowMs ?? 15 * 60 * 1000,
    limit: options.loginMax ?? 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = req.ip ?? 'unknown';
      const rawEmail =
        typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'no-email';
      return `login:${ip}:${rawEmail}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Muitas tentativas de login falhas. Aguarde alguns minutos e tente novamente.',
      });
    },
  });

  const registerLimiter = rateLimit({
    windowMs: options.registerWindowMs ?? 60 * 60 * 1000,
    limit: options.registerMax ?? 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `register:${req.ip ?? 'unknown'}`,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Limite de cadastros atingido para este endereço. Tente novamente mais tarde.',
      });
    },
  });

  const refreshLimiter = rateLimit({
    windowMs: options.refreshWindowMs ?? 15 * 60 * 1000,
    limit: options.refreshMax ?? 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `refresh:${req.ip ?? 'unknown'}`,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Muitas renovações de sessão em sequência. Aguarde antes de tentar novamente.',
      });
    },
  });

  return { loginLimiter, registerLimiter, refreshLimiter };
}
