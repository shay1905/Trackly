import { useRef } from 'react';
import { TransactionType } from '../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type: TransactionType;
}

export default function AmountInput({ value, onChange, error, type }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    // Allow only one decimal point
    const parts = raw.split('.');
    const cleaned = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
    onChange(cleaned);
  };

  return (
    <div className={`amount-wrapper${error ? ' has-error' : ''}`} onClick={() => inputRef.current?.focus()}>
      <div className={`amount-currency${type === 'income' ? ' income' : ''}`}>₪</div>
      <input
        ref={inputRef}
        className="amount-input"
        type="tel"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={handleChange}
      />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
