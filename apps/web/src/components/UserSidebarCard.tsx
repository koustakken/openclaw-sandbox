import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import css from './UserSidebarCard.module.css';

type Props = {
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
  currentWeight: number;
  followers?: number;
  following?: number;
  isOwn?: boolean;
  isFollowing?: boolean;
  onToggleFollow?: () => void;
};

export function UserSidebarCard({
  email,
  username,
  firstName,
  lastName,
  contacts,
  city,
  weightCategory,
  currentWeight,
  followers = 0,
  following = 0,
  isOwn = true,
  isFollowing = false,
  onToggleFollow
}: Props) {
  const initials = (email.split('@')[0] ?? 'pl').slice(0, 2).toUpperCase();
  const displayName = `${firstName} ${lastName}`.trim() || 'Powerlifter';
  const login = username || email.split('@')[0] || email;

  return (
    <aside className={css.card}>
      <div className={css.avatar}>{initials}</div>
      <div className={css.name}>{displayName}</div>
      <div className={css.login}>{login}</div>
      <div className={css.bio}>Work</div>

      {isOwn ? (
        <Link to="/profile" className={css.editBtn}>
          <Button size="sm" style={{ width: '100%' }}>
            Edit profile
          </Button>
        </Link>
      ) : (
        <Button size="sm" style={{ width: '100%' }} onClick={onToggleFollow}>
          {isFollowing ? 'Unfollow' : 'Follow'}
        </Button>
      )}

      <div className={css.followRow}>
        <span className={css.icon}>👥</span>
        <strong>{followers}</strong> followers · <strong>{following}</strong> following
      </div>

      <div className={css.metaRow}>
        <span className={css.icon}>📍</span>
        <span>{city || '—'}</span>
      </div>
      <div className={css.metaRow}>
        <span className={css.icon}>⚖️</span>
        <span>
          {weightCategory || '—'} · {currentWeight || 0} кг
        </span>
      </div>
      <div className={css.metaRow}>
        <span className={css.icon}>☎️</span>
        <span>{contacts || '—'}</span>
      </div>
    </aside>
  );
}
