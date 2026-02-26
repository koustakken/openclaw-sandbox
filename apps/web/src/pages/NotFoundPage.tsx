import { Link } from 'react-router-dom';
import css from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <section className={css.wrap}>
      <div className={css.card}>
        <p className={css.code}>404</p>
        <h2>Page not found</h2>
        <p className={css.text}>The page you are looking for doesn’t exist or has been moved.</p>
        <p>
          <Link to="/" className={css.link}>
            Go back home
          </Link>
        </p>
      </div>
    </section>
  );
}
