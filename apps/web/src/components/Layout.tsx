import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', lineHeight: 1.5 }}>
      <h1>openclaw-sandbox</h1>
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Link to="/">Home</Link>
        <Link to="/health">Health</Link>
      </nav>
      <Outlet />
    </main>
  );
}
