import type { HealthResponse } from '@packages/shared';
import type { AuthResponse } from '../types/auth';
import { authStorage } from './authStorage';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = authStorage.getToken();

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
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
  me: () => request<{ user: { sub: string; email: string } }>('/api/auth/me')
};
