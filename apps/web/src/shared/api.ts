import type { AuthResponse } from '../types/auth';
import { authStorage } from './authStorage';

type HealthResponse = {
  ok: boolean;
  service: string;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api';

function buildUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

function mapHttpError(status: number, text: string) {
  if (status === 405 && text.includes('405 Not Allowed')) {
    return 'Auth API is not configured for this environment. Set VITE_API_BASE_URL to your backend URL.';
  }

  return text || `HTTP ${status}`;
}

async function rawRequest(path: string, init?: RequestInit) {
  const accessToken = authStorage.getAccessToken();

  return fetch(buildUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!res.ok) {
    authStorage.clearSession();
    return false;
  }

  const tokens = (await res.json()) as RefreshResponse;
  authStorage.setSession(tokens);
  return true;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawRequest(path, init);

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await rawRequest(path, init);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(mapHttpError(res.status, text));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  getHealth: () => request<HealthResponse>('/health'),
  register: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: authStorage.getRefreshToken() })
    }),
  me: () => request<{ user: { sub: string; email: string } }>('/auth/me')
};
