import { useEffect, useState } from 'react';
import { api } from '../shared/api';
import css from './Page.module.css';

export function ProfilePage() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((res) => setEmail(res.user.email))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className={css.error}>{error}</p>;

  return (
    <section className={css.section}>
      <h2>Profile</h2>
      <p>You are logged in as: {email}</p>
    </section>
  );
}
