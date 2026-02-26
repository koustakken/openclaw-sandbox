import { Link, Outlet, useNavigate } from 'react-router-dom';
import { authStorage } from '../shared/authStorage';

export function Layout() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(authStorage.getToken());

  const logout = () => {
    authStorage.clearToken();
    navigate('/login');
  };

  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', lineHeight: 1.5 }}>
      <h1>openclaw-sandbox</h1>
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <Link to="/">Home</Link>
        <Link to="/health">Health</Link>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
        <Link to="/profile">Profile</Link>
        {isLoggedIn && (
          <button type="button" onClick={logout}>
            Logout
          </button>
        )}
      </nav>
      <Outlet />
    </main>
  );
}
