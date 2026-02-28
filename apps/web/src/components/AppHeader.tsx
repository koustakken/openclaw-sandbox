import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import css from './AppHeader.module.css';

type Props = {
  onLogout: () => void;
};

export function AppHeader({ onLogout }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ username: string; firstName: string; lastName: string }>
  >([]);

  const onSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    const found = await api.searchUsers(text.trim());
    setResults(
      found.map((u) => ({ username: u.username, firstName: u.firstName, lastName: u.lastName }))
    );
  };

  return (
    <header className={css.header}>
      <div className={css.topRow}>
        <Link to="/" className={css.brand}>
          <span className={css.logo} aria-hidden>
            🏋️
          </span>
          <span>PowerHub</span>
        </Link>

        <div className={css.searchWrap}>
          <input
            className={css.search}
            placeholder="Search users by username"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
          {results.length > 0 && (
            <div className={css.searchResults}>
              {results.map((r) => (
                <button
                  key={r.username}
                  className={css.searchItem}
                  type="button"
                  onClick={() => {
                    navigate(`/${r.username}`);
                    setResults([]);
                    setQuery('');
                  }}
                >
                  <strong>@{r.username}</strong>
                  <span>{`${r.firstName} ${r.lastName}`.trim() || 'user'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
