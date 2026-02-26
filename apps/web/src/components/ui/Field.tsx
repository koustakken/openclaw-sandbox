import type { InputHTMLAttributes } from 'react';
import css from './Field.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Field({ label, id, className, ...props }: Props) {
  const fieldId = id ?? props.name ?? label;

  return (
    <label className={css.wrap} htmlFor={fieldId}>
      <span className={css.label}>{label}</span>
      <input id={fieldId} className={[css.input, className].filter(Boolean).join(' ')} {...props} />
    </label>
  );
}
