type HealthResponse = {
  ok: boolean;
  service: string;
};

export function getHealth(): HealthResponse {
  return { ok: true, service: 'api' };
}
