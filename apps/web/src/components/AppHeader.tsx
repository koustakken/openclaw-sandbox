import { Link, NavLink } from 'react-router-dom';
import css from './AppHeader.module.css';

type Props = {
  onLogout: () => void;
};

export function AppHeader({ onLogout }: Props) {
  return (
    <header className={css.header}>
      <div className={css.topRow}>
        <Link to="/" className={css.brand}>
          <span className={css.logo} aria-hidden>
            🏋️
          </span>
          <span>koustakken</span>
        </Link>

        <div className={css.actions}>
          <button className={css.iconBtn} type="button" aria-label="notifications">
            🔔
          </button>
          <button className={css.iconBtn} type="button" aria-label="settings">
            ⚙️
          </button>
          <button className={css.iconBtn} type="button" aria-label="profile">
            👤
          </button>
        </div>
      </div>

      <nav className={css.tabs}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${css.tab} ${isActive ? css.tabActive : ''}`}
        >
          <span>🏠</span> Overview
        </NavLink>
        <NavLink
          to="/health"
          className={({ isActive }) => `${css.tab} ${isActive ? css.tabActive : ''}`}
        >
          <span>📈</span> Health
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => `${css.tab} ${isActive ? css.tabActive : ''}`}
        >
          <span>🧍</span> Profile
        </NavLink>
        <button type="button" onClick={onLogout} className={css.logout}>
          Logout
        </button>
      </nav>
    </header>
  );
}
