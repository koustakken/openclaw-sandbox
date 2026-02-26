import { Outlet, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { authStorage } from '../shared/authStorage';
import { AppHeader } from './AppHeader';
import css from './Layout.module.css';

export function Layout() {
  const navigate = useNavigate();

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
      <AppHeader onLogout={logout} />
      <section className={css.container}>
        <Outlet />
      </section>
    </main>
  );
}
