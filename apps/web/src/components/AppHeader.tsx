import { Link } from 'react-router-dom';
import css from './AppHeader.module.css';

type Props = {
  onLogout: () => void;
};

export function AppHeader({ onLogout }: Props) {
  return (
    <header className={css.header}>
      <div className={css.inner}>
        <Link to="/" className={css.brand}>
          <span className={css.logo} aria-hidden>
            🏋️
          </span>
          <span>PowerHub</span>
        </Link>

        <nav className={css.nav}>
          <Link className={css.link} to="/">
            Home
          </Link>
          <Link className={css.link} to="/health">
            Health
          </Link>
          <Link className={css.link} to="/profile">
            Profile
          </Link>
          <button type="button" onClick={onLogout} className={css.logout}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
