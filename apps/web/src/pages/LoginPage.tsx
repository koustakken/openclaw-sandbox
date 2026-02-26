import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { authStorage } from '../shared/authStorage';
import css from './AuthPage.module.css';

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
    <section className={css.page}>
      <div className={css.card}>
        <h2>Login</h2>

        <form onSubmit={onSubmit} className={css.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Sign in</button>
        </form>

        {error && <p className={css.error}>{error}</p>}

        <p className={css.linkRow}>
          Нет аккаунта?{' '}
          <Link to="/register" className={css.link}>
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </section>
  );
}
