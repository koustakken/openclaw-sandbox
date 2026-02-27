import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { authStorage } from '../shared/authStorage';
import { api } from '../shared/api';
import css from './ProfilePage.module.css';

type ProfileModel = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
  currentWeight: number;
  followers: number;
  following: number;
};

export function ProfilePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'profile' | 'account'>('profile');
  const [profile, setProfile] = useState<ProfileModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [followUsername, setFollowUsername] = useState('');
  const [followingList, setFollowingList] = useState<Array<{ username: string; email: string }>>(
    []
  );

  const load = async () => {
    try {
      const [data, follows] = await Promise.all([api.getProfile(), api.listFollowing()]);
      setProfile(data);
      setFollowingList(follows.map((f) => ({ username: f.username, email: f.email })));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p>{error}</p>;
  if (!profile) return null;

  return (
    <section className={css.layout}>
      <aside className={css.sidebar}>
        <button
          className={`${css.tab} ${tab === 'profile' ? css.tabActive : ''}`}
          onClick={() => setTab('profile')}
          type="button"
        >
          Profile
        </button>
        <button
          className={`${css.tab} ${tab === 'account' ? css.tabActive : ''}`}
          onClick={() => setTab('account')}
          type="button"
        >
          Account
        </button>
      </aside>

      <div className={css.panel}>
        {saved && <Notification tone="info">{saved}</Notification>}

        {tab === 'profile' && (
          <div className={css.section}>
            <h2>Public profile</h2>
            <div className={css.row}>
              <Field
                label="Имя"
                value={profile.firstName}
                onChange={(e) => setProfile((p) => (p ? { ...p, firstName: e.target.value } : p))}
              />
              <Field
                label="Фамилия"
                value={profile.lastName}
                onChange={(e) => setProfile((p) => (p ? { ...p, lastName: e.target.value } : p))}
              />
            </div>
            <Field
              label="Контакты"
              value={profile.contacts}
              onChange={(e) => setProfile((p) => (p ? { ...p, contacts: e.target.value } : p))}
            />
            <Field
              label="Город"
              value={profile.city}
              onChange={(e) => setProfile((p) => (p ? { ...p, city: e.target.value } : p))}
            />
            <div className={css.row}>
              <Field
                label="Весовая категория"
                value={profile.weightCategory}
                onChange={(e) =>
                  setProfile((p) => (p ? { ...p, weightCategory: e.target.value } : p))
                }
              />
              <Field
                label="Актуальный вес (кг)"
                value={String(profile.currentWeight ?? 0)}
                onChange={(e) =>
                  setProfile((p) => (p ? { ...p, currentWeight: Number(e.target.value || 0) } : p))
                }
              />
            </div>
            <Button
              variant="primary"
              onClick={async () => {
                await api.updateProfile({
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  contacts: profile.contacts,
                  city: profile.city,
                  weightCategory: profile.weightCategory,
                  currentWeight: profile.currentWeight,
                  username: profile.username
                });
                setSaved('Профиль обновлён');
              }}
            >
              Save profile
            </Button>
          </div>
        )}

        {tab === 'account' && (
          <>
            <div className={css.section}>
              <h2>Account settings</h2>
              <Field
                label="Username"
                value={profile.username}
                onChange={(e) => setProfile((p) => (p ? { ...p, username: e.target.value } : p))}
              />
              <Field label="Email" value={profile.email} disabled />
              <Button
                onClick={async () => {
                  await api.updateProfile({ username: profile.username });
                  setSaved('Username updated');
                }}
              >
                Save username
              </Button>
            </div>

            <div className={css.section}>
              <h3>Subscriptions</h3>
              <p>
                Followers: <strong>{profile.followers}</strong> · Following:{' '}
                <strong>{profile.following}</strong>
              </p>
              <div className={css.row}>
                <Field
                  label="Username to follow"
                  value={followUsername}
                  onChange={(e) => setFollowUsername(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    if (!followUsername.trim()) return;
                    await api.followUser(followUsername.trim());
                    setFollowUsername('');
                    await load();
                    setSaved('Subscription updated');
                  }}
                >
                  Follow
                </Button>
              </div>
              {followingList.length > 0 && (
                <div>
                  {followingList.map((u) => (
                    <div
                      key={u.email}
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}
                    >
                      <span>@{u.username}</span>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await api.unfollowUser(u.username);
                          await load();
                          setSaved('Unfollowed');
                        }}
                      >
                        Unfollow
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={css.section}>
              <h3>Change password</h3>
              <Field
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Field
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                onClick={async () => {
                  await api.changePassword({ currentPassword, newPassword });
                  setCurrentPassword('');
                  setNewPassword('');
                  setSaved('Password changed');
                }}
              >
                Change password
              </Button>
            </div>

            <div className={`${css.section} ${css.danger}`}>
              <h3>Delete account</h3>
              <p>
                Это действие необратимо. Введи <strong>DELETE</strong> для подтверждения.
              </p>
              <Field
                label="Confirmation"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE"
              />
              <Button
                onClick={async () => {
                  if (deleteConfirm !== 'DELETE') {
                    setSaved('Введите DELETE для подтверждения удаления');
                    return;
                  }
                  await api.deleteAccount();
                  authStorage.clearSession();
                  navigate('/login');
                }}
              >
                Delete account
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
