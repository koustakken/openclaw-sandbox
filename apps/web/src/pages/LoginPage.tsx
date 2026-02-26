import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { Typography } from '../components/ui/Typography';
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
      navigate('/profile');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <section className={css.section}>
      <Typography as="h2" variant="h2">
        Login
      </Typography>

      <form onSubmit={onSubmit} className={css.form}>
        <Field
          label="Email"
          type="email"
          placeholder="you@example.com"
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

      <Typography variant="muted">
        No account yet?{' '}
        <Link className={css.link} to="/register">
          Create one
        </Link>
      </Typography>
    </section>
  );
}
