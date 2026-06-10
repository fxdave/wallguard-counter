import { useState, type InputHTMLAttributes } from 'react';
import { TextField } from './Field';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface DateFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'pattern' | 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * Text input for YYYY-MM-DD dates. Shows an inline validation error on blur
 * if the value doesn't match the expected format.
 */
export function DateField({ label, value, onChange, error: externalError, ...rest }: DateFieldProps) {
  const [touched, setTouched] = useState(false);

  const formatError =
    touched && value.length > 0 && !DATE_RE.test(value)
      ? 'Use YYYY-MM-DD format.'
      : null;

  const displayError = externalError ?? formatError;

  return (
    <div>
      <TextField
        label={label}
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        {...rest}
      />
      {displayError && (
        <p className="mt-1 text-xs text-red-400">{displayError}</p>
      )}
    </div>
  );
}
