import type { ButtonHTMLAttributes } from 'react';
import css from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary';
};

export function Button({ variant = 'default', className, ...props }: Props) {
  const classes = [css.button, variant === 'primary' ? css.primary : '', className]
    .filter(Boolean)
    .join(' ');

  return <button {...props} className={classes} />;
}
