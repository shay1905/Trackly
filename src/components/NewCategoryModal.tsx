import { useState, useEffect } from 'react';
import { Category, TransactionType } from '../types';
import { inferIcon } from '../utils/inferIcon';

interface Props {
  defaultType: TransactionType;
  onSave: (cat: Category) => void;
  onClose: () => void;
}

export default function NewCategoryModal({ defaultType, onSave, onClose }: Props) {
  const [label,         setLabel]         = useState('');
  const [inferredIcon,  setInferredIcon]  = useState('🏷️');
  const [type,          setType]          = useState<TransactionType>(defaultType);
  const [isQuick,       setIsQuick]       = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => { setInferredIcon(inferIcon(label)); }, [label]);

  const handleSave = () => {
    if (!label.trim()) { setError('נדרש שם לקטגוריה'); return; }
    const ts = Date.now();
    onSave({
      id: `custom-cat-${ts}`,
      label: label.trim(),
      icon: inferredIcon,
      isQuick,
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
            <div className="inferred-icon-preview">{inferredIcon}</div>
            <input
              className="field-input name-input-flex"
              autoFocus
              placeholder="למשל: ספורט"
              value={label}
              onChange={(e) => { setLabel(e.target.value); setError(''); }}
            />
          </div>
          <p className="field-hint">האייקון נבחר אוטומטית לפי השם</p>
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
            <label className="modal-switch-row">
              <span className="modal-switch-label">הצג בדיווחים מהירים</span>
              <div className={`switch${isQuick ? ' on' : ''}`} onClick={() => setIsQuick((v) => !v)} />
            </label>
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
