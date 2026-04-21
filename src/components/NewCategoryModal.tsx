import { useState, useEffect } from 'react';
import { Category, TransactionType } from '../types';
import { inferIcon } from '../utils/inferIcon';

function extractEmoji(input: string): string {
  if (!input) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segs = [...new (Intl as typeof Intl & { Segmenter: new () => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter().segment(input)];
    return segs[segs.length - 1]?.segment ?? input;
  }
  return [...input].slice(-2).join('');
}

interface Props {
  defaultType: TransactionType;
  onSave: (cat: Category) => void;
  onClose: () => void;
}

export default function NewCategoryModal({ defaultType, onSave, onClose }: Props) {
  const [label,        setLabel]        = useState('');
  const [icon,         setIcon]         = useState('🏷️');
  const [iconUserSet,  setIconUserSet]  = useState(false);
  const [type,         setType]         = useState<TransactionType>(defaultType);
  const [section,      setSection]      = useState<'quick' | 'additional'>('quick');
  const [error,        setError]        = useState('');

  // Auto-suggest icon from label when user hasn't manually set one
  useEffect(() => {
    if (!iconUserSet) {
      setIcon(inferIcon(label));
    }
  }, [label, iconUserSet]);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) {
      setIconUserSet(false);
      setIcon(inferIcon(label));
    } else {
      setIcon(extractEmoji(val) || val);
      setIconUserSet(true);
    }
  };

  const handleSave = () => {
    if (!label.trim()) { setError('נדרש שם לקטגוריה'); return; }
    const ts = Date.now();
    onSave({
      id: `custom-cat-${ts}`,
      label: label.trim(),
      icon: icon || '🏷️',
      isQuick: type === 'income' || section === 'quick',
      subcategories: [],
      type,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">קטגוריה חדשה</h2>

        <div className="modal-field">
          <label className="field-label">שם הקטגוריה</label>
          <div className="name-with-icon">
            <input
              className="inferred-icon-preview"
              type="text"
              inputMode="text"
              value={icon}
              onChange={handleIconChange}
              aria-label="אייקון"
            />
            <input
              className="field-input name-input-flex"
              autoFocus
              placeholder="למשל: ספורט"
              value={label}
              onChange={(e) => { setLabel(e.target.value); setError(''); }}
            />
          </div>
          <p className="field-hint">האייקון נבחר אוטומטית — אפשר לשנות ידנית</p>
        </div>

        <div className="modal-field">
          <label className="field-label">סוג</label>
          <div className="modal-toggle">
            <button type="button" className={`toggle-btn${type === 'expense' ? ' active expense' : ''}`} onClick={() => setType('expense')}>הוצאה</button>
            <button type="button" className={`toggle-btn${type === 'income' ? ' active income' : ''}`} onClick={() => setType('income')}>הכנסה</button>
          </div>
        </div>

        {type === 'expense' && (
          <div className="modal-field">
            <label className="field-label">מיקום</label>
            <div className="section-chips">
              <button
                type="button"
                className={`chip${section === 'quick' ? ' selected expense' : ''}`}
                onClick={() => setSection('quick')}
              >שכיחים</button>
              <button
                type="button"
                className={`chip${section === 'additional' ? ' selected expense' : ''}`}
                onClick={() => setSection('additional')}
              >נוספים</button>
            </div>
          </div>
        )}

        {error && <p className="field-error" style={{ marginBottom: 8 }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>ביטול</button>
          <button type="button" className="modal-save" onClick={handleSave}>צור קטגוריה</button>
        </div>
      </div>
    </div>
  );
}
