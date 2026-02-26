import type { HealthResponse } from '@packages/shared';
import type { AuthResponse } from '../types/auth';
import { authStorage } from './authStorage';

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

async function rawRequest(url: string, init?: RequestInit) {
  const accessToken = authStorage.getAccessToken();

  return fetch(url, {
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

  const res = await fetch('/api/auth/refresh', {
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res = await rawRequest(url, init);

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await rawRequest(url, init);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  getHealth: () => request<HealthResponse>('/api/health'),
  register: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  logout: () =>
    request<void>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: authStorage.getRefreshToken() })
    }),
  me: () => request<{ user: { sub: string; email: string } }>('/api/auth/me')
};
