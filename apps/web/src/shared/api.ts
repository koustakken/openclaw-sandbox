import type { HealthResponse } from '@packages/shared';

async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export const api = {
  getHealth: () => request<HealthResponse>('/api/health')
};
