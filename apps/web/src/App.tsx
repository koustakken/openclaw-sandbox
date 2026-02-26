import { useEffect, useState } from 'react';

type HealthResponse = {
  ok: boolean;
  service: string;
};

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as HealthResponse;
      })
      .then(setHealth)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', lineHeight: 1.5 }}>
      <h1>openclaw-sandbox</h1>
      <p>Vite + React + TypeScript is ready.</p>

      <h2>API status</h2>
      {health && <p>✅ {health.service}: OK</p>}
      {error && <p>❌ API error: {error}</p>}
      {!health && !error && <p>Checking API...</p>}
    </main>
  );
}
