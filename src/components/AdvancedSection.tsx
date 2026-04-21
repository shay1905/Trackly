import { RecurrenceType, TransactionType } from '../types';
import { countOccurrences } from '../utils/recurrence';

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'one-time', label: 'חד פעמי' },
  { value: 'monthly', label: 'חודשי' },
  { value: 'weekly', label: 'שבועי' },
  { value: 'yearly', label: 'שנתי' },
];

export type RecurrenceEndMode = 'occurrences' | 'end-date';

interface Props {
  open: boolean;
  onToggle: () => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
  installments: number;
  onInstallmentsChange: (v: number) => void;
  recurrence: RecurrenceType;
  onRecurrenceChange: (v: RecurrenceType) => void;
  recurrenceEndMode: RecurrenceEndMode;
  onRecurrenceEndModeChange: (v: RecurrenceEndMode) => void;
  recurrenceOccurrences: number;
  onRecurrenceOccurrencesChange: (v: number) => void;
  recurrenceEndDate: string;
  onRecurrenceEndDateChange: (v: string) => void;
  type: TransactionType;
}

export default function AdvancedSection({
  open, onToggle,
  description, onDescriptionChange,
  date, onDateChange,
  installments, onInstallmentsChange,
  recurrence, onRecurrenceChange,
  recurrenceEndMode, onRecurrenceEndModeChange,
  recurrenceOccurrences, onRecurrenceOccurrencesChange,
  recurrenceEndDate, onRecurrenceEndDateChange,
  type,
}: Props) {
  const isRecurring = recurrence !== 'one-time';

  const endDateCount = recurrenceEndMode === 'end-date' && recurrenceEndDate
    ? countOccurrences(date, recurrence, recurrenceEndDate)
    : null;

  return (
    <div className="advanced-section">
      <button className="advanced-toggle" onClick={onToggle} type="button">
        <svg className={`chevron-icon${open ? ' open' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>פרטים נוספים</span>
      </button>

      <div className={`advanced-body${open ? ' open' : ''}`}>
        {/* Description */}
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

        {/* Date */}
        <div className="field-group">
          <label className="field-label">תאריך</label>
          <input
            className="field-input"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>

        {/* ── Expense-only fields ── */}
        {type === 'expense' && (
          <>
            {/* Installments */}
            <div className="field-group">
              <label className="field-label">תשלומים</label>
              <div className="installments-row">
                <button
                  className="stepper-btn"
                  type="button"
                  onClick={() => onInstallmentsChange(Math.max(1, installments - 1))}
                  disabled={installments <= 1}
                >−</button>
                <span className="stepper-value">{installments}</span>
                <button
                  className="stepper-btn"
                  type="button"
                  onClick={() => onInstallmentsChange(installments + 1)}
                  disabled={isRecurring}
                >+</button>
              </div>
              {installments > 1 && (
                <p className="field-note-info">ייווצרו {installments} עסקאות חודשיות נפרדות</p>
              )}
              {isRecurring && installments > 1 && (
                <p className="field-note">לא ניתן לשלב תשלומים עם חיוב קבוע</p>
              )}
            </div>

            {/* Recurrence type */}
            <div className="field-group">
              <label className="field-label">חיוב קבוע</label>
              <div className="recurrence-chips">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`chip${recurrence === opt.value ? ` selected ${type}` : ''}${opt.value !== 'one-time' && installments > 1 ? ' disabled' : ''}`}
                    onClick={() => {
                      if (opt.value !== 'one-time' && installments > 1) return;
                      onRecurrenceChange(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence end condition — only shown when a recurring type is selected */}
            {isRecurring && (
              <div className="field-group recurrence-end-group">
                <label className="field-label">סיום חיוב קבוע</label>

                {/* End mode selector */}
                <div className="recurrence-end-mode-row">
                  <button
                    type="button"
                    className={`chip${recurrenceEndMode === 'occurrences' ? ` selected ${type}` : ''}`}
                    onClick={() => onRecurrenceEndModeChange('occurrences')}
                  >מספר מופעים</button>
                  <button
                    type="button"
                    className={`chip${recurrenceEndMode === 'end-date' ? ` selected ${type}` : ''}`}
                    onClick={() => onRecurrenceEndModeChange('end-date')}
                  >תאריך סיום</button>
                </div>

                {/* Occurrences input */}
                {recurrenceEndMode === 'occurrences' && (
                  <div className="installments-row" style={{ marginTop: 10 }}>
                    <button
                      className="stepper-btn"
                      type="button"
                      onClick={() => onRecurrenceOccurrencesChange(Math.max(2, recurrenceOccurrences - 1))}
                      disabled={recurrenceOccurrences <= 2}
                    >−</button>
                    <span className="stepper-value">{recurrenceOccurrences}</span>
                    <button
                      className="stepper-btn"
                      type="button"
                      onClick={() => onRecurrenceOccurrencesChange(recurrenceOccurrences + 1)}
                    >+</button>
                    <span className="recurrence-count-label">מופעים</span>
                  </div>
                )}

                {/* End date input */}
                {recurrenceEndMode === 'end-date' && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      className="field-input"
                      type="date"
                      value={recurrenceEndDate}
                      min={date}
                      onChange={(e) => onRecurrenceEndDateChange(e.target.value)}
                    />
                    {endDateCount !== null && endDateCount > 0 && (
                      <p className="field-note-info">ייווצרו {endDateCount} עסקאות</p>
                    )}
                    {recurrenceEndDate && recurrenceEndDate <= date && (
                      <p className="field-note">תאריך הסיום חייב להיות אחרי תאריך ההתחלה</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
