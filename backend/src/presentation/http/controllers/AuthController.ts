import { Request, Response } from 'express';
import { LoginUserInput, RegisterUserInput } from '../../../application/dtos/AuthDtos';
import { GetCurrentUserUseCase } from '../../../application/use-cases/auth/GetCurrentUserUseCase';
import { LoginUserUseCase } from '../../../application/use-cases/auth/LoginUserUseCase';
import { LogoutUseCase } from '../../../application/use-cases/auth/LogoutUseCase';
import { RefreshSessionUseCase } from '../../../application/use-cases/auth/RefreshSessionUseCase';
import { RegisterUserUseCase } from '../../../application/use-cases/auth/RegisterUserUseCase';
import { UnauthorizedError } from '../../../domain/errors';
import {
  clearAuthCookies,
  CookieConfig,
  issueCsrfCookie,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
} from '../cookies';

export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly cookieConfig: CookieConfig,
  ) {}

  public csrf = (_req: Request, res: Response): void => {
    const csrfToken = issueCsrfCookie(res, this.cookieConfig);
    res.status(200).json({ csrfToken });
  };

  public register = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as RegisterUserInput;
    const session = await this.registerUserUseCase.execute(input);

    const csrfToken = setAuthCookies(
      res,
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
      this.cookieConfig,
    );

    res.status(201).json({ user: session.user, csrfToken });
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as LoginUserInput;
    const session = await this.loginUserUseCase.execute(input);

    const csrfToken = setAuthCookies(
      res,
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
      this.cookieConfig,
    );

    res.status(200).json({ user: session.user, csrfToken });
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof rawRefreshToken !== 'string' || rawRefreshToken.length === 0) {
      clearAuthCookies(res, this.cookieConfig);
      throw new UnauthorizedError('Refresh token ausente. Faça login novamente.');
    }

    try {
      const session = await this.refreshSessionUseCase.execute(rawRefreshToken);
      const csrfToken = setAuthCookies(
        res,
        { accessToken: session.accessToken, refreshToken: session.refreshToken },
        this.cookieConfig,
      );
      res.status(200).json({ user: session.user, csrfToken });
    } catch (error) {
      clearAuthCookies(res, this.cookieConfig);
      throw error;
    }
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const rawRefreshToken =
      typeof req.cookies?.[REFRESH_COOKIE_NAME] === 'string'
        ? req.cookies[REFRESH_COOKIE_NAME]
        : undefined;

    await this.logoutUseCase.execute(rawRefreshToken);
    clearAuthCookies(res, this.cookieConfig);
    res.status(200).json({ ok: true });
  };

  public me = async (req: Request, res: Response): Promise<void> => {
    if (!req.authUser) {
      throw new UnauthorizedError();
    }
    const user = await this.getCurrentUserUseCase.execute(req.authUser.id);
    const csrfToken = issueCsrfCookie(res, this.cookieConfig);
    res.status(200).json({ user, csrfToken });
  };
}
