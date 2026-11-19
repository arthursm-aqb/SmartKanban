export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string;
}

export interface GeneratedRefreshToken {
  rawToken: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  generateRefreshToken(userId: string, existingFamilyId?: string): GeneratedRefreshToken;
  verifyRefreshToken(token: string): RefreshTokenPayload;
  hashToken(rawToken: string): string;
}
