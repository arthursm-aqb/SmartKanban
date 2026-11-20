const API_BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '')
  .trim()
  .replace(/\/+$/, '');

let cachedCsrfToken = '';
let csrfInFlight: Promise<string> | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fields?: Record<string, string[] | undefined>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function readCookie(name: string): string {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return '';
}

async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  const fromCookie = readCookie('kanban_csrf_token');
  if (!forceRefresh) {
    if (fromCookie) {
      cachedCsrfToken = fromCookie;
      return fromCookie;
    }
    // Em deploys cross-origin (Vercel + Railway), document.cookie não lê cookies do domínio da API;
    // reutiliza o token retornado no JSON das respostas de autenticação/CSRF até expirar.
    if (cachedCsrfToken) {
      return cachedCsrfToken;
    }
  } else {
    cachedCsrfToken = '';
  }

  if (!csrfInFlight) {
    csrfInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as { csrfToken?: string };
          const refreshedCookie = readCookie('kanban_csrf_token');
          const token = refreshedCookie || data.csrfToken || '';
          if (token) {
            cachedCsrfToken = token;
            return token;
          }
        }
        return readCookie('kanban_csrf_token') || cachedCsrfToken;
      } finally {
        csrfInFlight = null;
      }
    })();
  }

  return csrfInFlight;
}

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        let csrf = await ensureCsrfToken();
        let res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': csrf,
          },
        });
        if (res.status === 403) {
          csrf = await ensureCsrfToken(true);
          res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'X-CSRF-Token': csrf,
            },
          });
        }
        if (res.ok) {
          const data = (await res.json()) as { csrfToken?: string };
          if (data.csrfToken) cachedCsrfToken = data.csrfToken;
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipAutoRefresh?: boolean; skipCsrfRetry?: boolean } = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = new Headers(options.headers);

  if (isMutating) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (
    res.status === 401 &&
    !options.skipAutoRefresh &&
    !path.startsWith('/api/auth/login') &&
    !path.startsWith('/api/auth/register') &&
    !path.startsWith('/api/auth/refresh')
  ) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAutoRefresh: true });
    }
  }

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    fields?: Record<string, string[] | undefined>;
    csrfToken?: string;
  };

  if (payload.csrfToken) {
    cachedCsrfToken = payload.csrfToken;
  }

  if (
    res.status === 403 &&
    isMutating &&
    !options.skipCsrfRetry &&
    (payload.message ?? '').toLowerCase().includes('anti-csrf')
  ) {
    await ensureCsrfToken(true);
    return apiFetch<T>(path, { ...options, skipCsrfRetry: true });
  }

  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      payload.error ?? 'API_ERROR',
      payload.message ?? 'Não foi possível completar a requisição.',
      payload.fields,
    );
  }

  return payload as T;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
