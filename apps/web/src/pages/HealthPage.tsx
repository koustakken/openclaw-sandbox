import { useEffect, useState } from 'react';
import type { HealthResponse } from '@packages/shared';
import { api } from '../shared/api';

export function HealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then(setHealth)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  }, []);

  if (error) return <p>❌ API error: {error}</p>;
  if (!health) return <p>Checking API...</p>;

  return <p>✅ {health.service}: OK</p>;
}
