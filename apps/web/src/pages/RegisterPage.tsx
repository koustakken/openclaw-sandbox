import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { api } from '../shared/api';
import { authStorage } from '../shared/authStorage';
import css from './AuthForm.module.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await api.register({ email, password });
      authStorage.setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
      navigate('/profile');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <section className={css.section}>
      <div className={css.shell}>
        <div className={css.logo}>🏋️</div>
        <h1 className={css.title}>Create your account</h1>

        <div className={css.card}>
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
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />

            <Button type="submit" variant="primary">
              Create account
            </Button>
          </form>

          {error && <Notification tone="error">{error}</Notification>}
        </div>

        <div className={css.switchCard}>
          Already have an account?{' '}
          <Link className={css.link} to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
