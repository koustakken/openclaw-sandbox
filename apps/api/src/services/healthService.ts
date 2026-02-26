import type { HealthResponse } from '@packages/shared';

export function getHealth(): HealthResponse {
  return { ok: true, service: 'api' };
}
