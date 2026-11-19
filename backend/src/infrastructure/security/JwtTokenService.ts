import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  AccessTokenPayload,
  GeneratedRefreshToken,
  ITokenService,
  RefreshTokenPayload,
} from '../../application/ports/services/ITokenService';

export interface JwtTokenServiceConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresInSeconds?: number;
  refreshExpiresInSeconds?: number;
}

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class JwtTokenService implements ITokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(config: JwtTokenServiceConfig) {
    this.accessSecret = config.accessSecret;
    this.refreshSecret = config.refreshSecret;
    this.accessTtlSeconds = config.accessExpiresInSeconds ?? DEFAULT_ACCESS_TTL_SECONDS;
    this.refreshTtlSeconds = config.refreshExpiresInSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;
  }

  public signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessTtlSeconds,
      algorithm: 'HS256',
    });
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, this.accessSecret, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Invalid access token payload');
    }
    const { sub, email, name } = decoded as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof email !== 'string' || typeof name !== 'string') {
      throw new Error('Malformed access token claims');
    }
    return { sub, email, name };
  }

  public generateRefreshToken(userId: string, existingFamilyId?: string): GeneratedRefreshToken {
    const familyId = existingFamilyId ?? crypto.randomUUID();
    const jti = crypto.randomUUID();
    const rawToken = jwt.sign({ sub: userId, familyId, jti }, this.refreshSecret, {
      expiresIn: this.refreshTtlSeconds,
      algorithm: 'HS256',
    });

    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      familyId,
      expiresAt,
    };
  }

  public verifyRefreshToken(token: string): RefreshTokenPayload {
    const decoded = jwt.verify(token, this.refreshSecret, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Invalid refresh token payload');
    }
    const { sub, familyId, jti } = decoded as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof familyId !== 'string' || typeof jti !== 'string') {
      throw new Error('Malformed refresh token claims');
    }
    return { sub, familyId, jti };
  }

  public hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
