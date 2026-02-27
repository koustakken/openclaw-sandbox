import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { api } from '../shared/api';
import css from './Page.module.css';

type ProfileModel = {
  email: string;
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
  currentWeight: number;
};

export function ProfilePage() {
  const [profile, setProfile] = useState<ProfileModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setSaved(false);
    try {
      const data = await api.getProfile();
      setProfile(data);
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
  if (error) return <p className={css.error}>{error}</p>;
  if (!profile) return null;

  return (
    <section className={css.section}>
      <h2>Profile</h2>
      <p>Email: {profile.email}</p>

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
      <Field
        label="Весовая категория"
        value={profile.weightCategory}
        onChange={(e) => setProfile((p) => (p ? { ...p, weightCategory: e.target.value } : p))}
      />
      <Field
        label="Актуальный вес (кг)"
        value={String(profile.currentWeight ?? 0)}
        onChange={(e) =>
          setProfile((p) => (p ? { ...p, currentWeight: Number(e.target.value || 0) } : p))
        }
      />

      <Button
        variant="primary"
        onClick={async () => {
          await api.updateProfile({
            firstName: profile.firstName,
            lastName: profile.lastName,
            contacts: profile.contacts,
            city: profile.city,
            weightCategory: profile.weightCategory,
            currentWeight: Number(profile.currentWeight ?? 0)
          });
          setSaved(true);
        }}
      >
        Сохранить
      </Button>

      {saved && <Notification tone="info">Профиль обновлён</Notification>}
    </section>
  );
}
