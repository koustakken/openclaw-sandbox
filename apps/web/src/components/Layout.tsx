import { Link, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { authStorage } from '../shared/authStorage';
import css from './Layout.module.css';

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
    <main className={css.page}>
      <header className={css.header}>
        <strong>PowerHub</strong>
        <nav className={css.nav}>
          <Link className={css.link} to="/">
            Home
          </Link>
          <Link className={css.link} to="/health">
            Health
          </Link>
          <Link className={css.link} to="/login">
            Login
          </Link>
          <Link className={css.link} to="/register">
            Register
          </Link>
          <Link className={css.link} to="/profile">
            Profile
          </Link>
          {isLoggedIn && (
            <button type="button" onClick={logout} className={css.button}>
              Logout
            </button>
          )}
        </nav>
      </header>

      <section className={css.container}>
        <Outlet />
      </section>
    </main>
  );
}
