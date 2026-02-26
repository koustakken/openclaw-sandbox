import type { ReactNode } from 'react';
import css from './Typography.module.css';

type Props = {
  as?: 'h1' | 'h2' | 'p' | 'span';
  variant?: 'h1' | 'h2' | 'body' | 'muted' | 'link';
  children: ReactNode;
  className?: string;
};

export function Typography({ as = 'p', variant = 'body', children, className }: Props) {
  const Tag = as;
  const classes = [css[variant], className].filter(Boolean).join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
