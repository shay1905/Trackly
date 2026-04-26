import { TransactionMode, TransactionType } from '../types';

const MODE_OPTIONS: { value: TransactionMode; label: string }[] = [
  { value: 'one-time',          label: 'חד פעמית' },
  { value: 'installments',      label: 'תשלומים' },
  { value: 'monthly-recurring', label: 'חודשי קבוע' },
];

interface Props {
  open: boolean;
  onToggle: () => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
  type: TransactionType;
  transactionMode: TransactionMode;
  onTransactionModeChange: (v: TransactionMode) => void;
  installments: number;
  onInstallmentsChange: (v: number) => void;
}

export default function AdvancedSection({
  open, onToggle,
  description, onDescriptionChange,
  date, onDateChange,
  type,
  transactionMode, onTransactionModeChange,
  installments, onInstallmentsChange,
}: Props) {
  return (
    <div className="advanced-section">
      <button className="advanced-toggle" onClick={onToggle} type="button">
        <svg className={`chevron-icon${open ? ' open' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>פרטים נוספים</span>
      </button>

      <div className={`advanced-body${open ? ' open' : ''}`}>
        {/* Description — always shown */}
        <div className="field-group">
          <label className="field-label">תיאור</label>
          <input
            className="field-input"
            type="text"
            placeholder="הוסף תיאור..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        {/* Expense: 3-way mode chips + mode-specific fields */}
        {type === 'expense' && (
          <>
            <div className="field-group">
              <label className="field-label">סוג חיוב</label>
              <div className="recurrence-chips">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip${transactionMode === opt.value ? ` selected ${type}` : ''}`}
                    onClick={() => onTransactionModeChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {transactionMode === 'one-time' && (
              <div className="field-group">
                <label className="field-label">תאריך עסקה</label>
                <input
                  className="field-input"
                  type="date"
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                />
              </div>
            )}

            {transactionMode === 'installments' && (
              <>
                <div className="field-group">
                  <label className="field-label">תאריך תשלום ראשון</label>
                  <input
                    className="field-input"
                    type="date"
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">מספר תשלומים</label>
                  <div className="installments-row">
                    <button
                      className="stepper-btn"
                      type="button"
                      onClick={() => onInstallmentsChange(Math.max(2, installments - 1))}
                      disabled={installments <= 2}
                    >−</button>
                    <span className="stepper-value">{installments}</span>
                    <button
                      className="stepper-btn"
                      type="button"
                      onClick={() => onInstallmentsChange(installments + 1)}
                    >+</button>
                  </div>
                  <p className="field-note-info">ייווצרו {installments} עסקאות חודשיות נפרדות</p>
                </div>
              </>
            )}

            {transactionMode === 'monthly-recurring' && (
              <>
                <div className="field-group">
                  <label className="field-label">תאריך התחלה</label>
                  <input
                    className="field-input"
                    type="date"
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                  />
                </div>
                <p className="field-note-info" style={{ marginTop: '4px' }}>יחויב כל חודש עד שתבטל</p>
              </>
            )}
          </>
        )}

        {/* Income: just date */}
        {type === 'income' && (
          <div className="field-group">
            <label className="field-label">תאריך עסקה</label>
            <input
              className="field-input"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
