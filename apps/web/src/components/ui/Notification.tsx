import type { ReactNode } from 'react';
import css from './Notification.module.css';

type Props = {
  tone?: 'error' | 'info';
  children: ReactNode;
};

export function Notification({ tone = 'info', children }: Props) {
  return (
    <div className={[css.box, tone === 'error' ? css.error : css.info].join(' ')}>{children}</div>
  );
}
