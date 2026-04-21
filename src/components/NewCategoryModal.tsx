import { useState, useEffect } from 'react';
import { Category, TransactionType } from '../types';
import { inferIcon, inferSubcategoryIcon } from '../utils/inferIcon';

interface SubDraft {
  label: string;
  isDefault: boolean;
}

interface Props {
  defaultType: TransactionType;
  onSave: (cat: Category) => void;
  onClose: () => void;
}

export default function NewCategoryModal({ defaultType, onSave, onClose }: Props) {
  const [label, setLabel] = useState('');
  const [inferredIcon, setInferredIcon] = useState('🏷️');
  const [type, setType] = useState<TransactionType>(defaultType);
  const [isQuick, setIsQuick] = useState(false);
  const [requiresSubs, setRequiresSubs] = useState(false);
  const [subs, setSubs] = useState<SubDraft[]>([{ label: '', isDefault: true }]);
  const [error, setError] = useState('');

  // Auto-infer icon as user types
  useEffect(() => {
    setInferredIcon(inferIcon(label));
  }, [label]);

  const setDefaultSub = (idx: number) =>
    setSubs((prev) => prev.map((s, i) => ({ ...s, isDefault: i === idx })));

  const updateSubLabel = (idx: number, val: string) =>
    setSubs((prev) => prev.map((s, i) => (i === idx ? { ...s, label: val } : s)));

  const addSub = () =>
    setSubs((prev) => [...prev, { label: '', isDefault: false }]);

  const removeSub = (idx: number) => {
    setSubs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (prev[idx].isDefault && next.length > 0) next[0] = { ...next[0], isDefault: true };
      return next;
    });
  };

  const handleSave = () => {
    if (!label.trim()) { setError('נדרש שם לקטגוריה'); return; }
    const validSubs = requiresSubs ? subs.filter((s) => s.label.trim()) : [];
    if (requiresSubs && validSubs.length === 0) { setError('נדרשת לפחות תת קטגוריה אחת'); return; }

    const defaultSub = validSubs.find((s) => s.isDefault) ?? validSubs[0];
    const ts = Date.now();
    const subList = validSubs.map((s, i) => ({
      id: `custom-sub-init-${ts}-${i}`,
      label: s.label.trim(),
      icon: inferSubcategoryIcon(s.label.trim(), inferredIcon),
    }));
    const defaultSubId = defaultSub ? subList[validSubs.indexOf(defaultSub)]?.id : undefined;

    onSave({
      id: `custom-cat-${ts}`,
      label: label.trim(),
      icon: inferredIcon,
      isQuick: requiresSubs ? false : isQuick,
      subcategories: subList,
      defaultSubcategoryId: defaultSubId,
      type,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">קטגוריה חדשה</h2>

        {/* Name + live icon preview */}
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

        {/* Type */}
        <div className="modal-field">
          <label className="field-label">סוג</label>
          <div className="modal-toggle">
            <button type="button" className={`toggle-btn${type === 'expense' ? ' active expense' : ''}`} onClick={() => setType('expense')}>הוצאה</button>
            <button type="button" className={`toggle-btn${type === 'income' ? ' active income' : ''}`} onClick={() => setType('income')}>הכנסה</button>
          </div>
        </div>

        {/* Requires subcategories */}
        <div className="modal-field">
          <label className="modal-switch-row">
            <span className="modal-switch-label">דורש תת קטגוריות</span>
            <div className={`switch${requiresSubs ? ' on' : ''}`} onClick={() => { setRequiresSubs((v) => !v); setIsQuick(false); }} />
          </label>
        </div>

        {/* Quick (only when no subs required) */}
        {!requiresSubs && (
          <div className="modal-field">
            <label className="modal-switch-row">
              <span className="modal-switch-label">קטגוריה מהירה</span>
              <div className={`switch${isQuick ? ' on' : ''}`} onClick={() => setIsQuick((v) => !v)} />
            </label>
          </div>
        )}

        {/* Subcategory builder */}
        {requiresSubs && (
          <div className="modal-field">
            <label className="field-label">תת קטגוריות</label>
            <div className="subs-builder">
              {subs.map((sub, idx) => (
                <div key={idx} className="sub-builder-row">
                  <div className="sub-builder-icon">
                    {sub.label.trim()
                      ? inferSubcategoryIcon(sub.label, inferredIcon)
                      : '🏷️'}
                  </div>
                  <button type="button" className={`default-dot${sub.isDefault ? ' on' : ''}`} onClick={() => setDefaultSub(idx)} title="קבע כברירת מחדל" />
                  <input
                    className="field-input sub-input"
                    placeholder={`תת קטגוריה ${idx + 1}`}
                    value={sub.label}
                    onChange={(e) => updateSubLabel(idx, e.target.value)}
                  />
                  {subs.length > 1 && (
                    <button type="button" className="sub-remove" onClick={() => removeSub(idx)}>×</button>
                  )}
                </div>
              ))}
              <button type="button" className="chip add-chip" onClick={addSub}>+ הוסף תת קטגוריה</button>
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
