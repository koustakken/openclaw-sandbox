import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { api } from '../shared/api';
import { authStorage } from '../shared/authStorage';
import css from './AuthForm.module.css';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await api.login({ email, password });
      authStorage.setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
      const profile = await api.getProfile();
      navigate(`/${profile.username}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <section className={css.section}>
      <div className={css.shell}>
        <div className={css.logo}>🏋️</div>
        <h1 className={css.title}>Sign in to PowerHub</h1>

        <div className={css.card}>
          <form onSubmit={onSubmit} className={css.form}>
            <Field
              label="Username or email address"
              type="text"
              placeholder="you@example.com or tema"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Field
              label="Password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="primary">
              Sign in
            </Button>
          </form>

          {error && <Notification tone="error">{error}</Notification>}
        </div>

        <div className={css.switchCard}>
          New to PowerHub?{' '}
          <Link className={css.link} to="/register">
            Create an account
          </Link>
        </div>
      </div>
    </section>
  );
}
