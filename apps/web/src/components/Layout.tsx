import { Link, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { authStorage } from '../shared/authStorage';

const styles = {
  page: {
    fontFamily:
      'ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
    minHeight: '100vh',
    background: '#f6f8fa',
    color: '#24292f',
    padding: '0'
  } as const,
  header: {
    background: '#24292f',
    color: '#f0f6fc',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  } as const,
  nav: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center'
  } as const,
  link: {
    color: '#f0f6fc',
    textDecoration: 'none',
    fontSize: '14px'
  } as const,
  container: {
    maxWidth: '980px',
    margin: '24px auto',
    background: '#ffffff',
    border: '1px solid #d0d7de',
    borderRadius: '8px',
    padding: '20px'
  } as const,
  button: {
    border: '1px solid #57606a',
    borderRadius: '6px',
    background: 'transparent',
    color: '#f0f6fc',
    padding: '6px 10px',
    cursor: 'pointer'
  } as const
};

export function Layout() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(authStorage.getAccessToken());

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // no-op: we clear local session regardless
    }

    authStorage.clearSession();
    navigate('/login');
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <strong>PowerHub</strong>
        <nav style={styles.nav}>
          <Link style={styles.link} to="/">
            Home
          </Link>
          <Link style={styles.link} to="/health">
            Health
          </Link>
          <Link style={styles.link} to="/login">
            Login
          </Link>
          <Link style={styles.link} to="/register">
            Register
          </Link>
          <Link style={styles.link} to="/profile">
            Profile
          </Link>
          {isLoggedIn && (
            <button type="button" onClick={logout} style={styles.button}>
              Logout
            </button>
          )}
        </nav>
      </header>

      <section style={styles.container}>
        <Outlet />
      </section>
    </main>
  );
}
