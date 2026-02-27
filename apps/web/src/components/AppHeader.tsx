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
          <span>PowerHub</span>
        </Link>

        <button type="button" onClick={onLogout} className={css.logout}>
          Logout
        </button>
      </div>

      <nav className={css.tabs}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${css.tab} ${isActive ? css.tabActive : ''}`}
        >
          <span>🏠</span> Overview
        </NavLink>
      </nav>
    </header>
  );
}
