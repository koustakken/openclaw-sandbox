import type { ButtonHTMLAttributes } from 'react';
import css from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary';
  size?: 'md' | 'sm';
};

export function Button({ variant = 'default', size = 'md', className, ...props }: Props) {
  const classes = [
    css.button,
    variant === 'primary' ? css.primary : '',
    size === 'sm' ? css.small : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return <button {...props} className={classes} />;
}
