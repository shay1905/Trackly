import { useState } from 'react';

interface Props {
  kind: 'category' | 'subcategory';
  icon: string;
  label: string;
  onSave: (icon: string, label: string) => void;
  onClose: () => void;
}

function extractEmoji(input: string): string {
  if (!input) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segs = [...new (Intl as typeof Intl & { Segmenter: new () => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter().segment(input)];
    return segs[segs.length - 1]?.segment ?? input;
  }
  return [...input].slice(-2).join('');
}

export default function EditItemModal({ kind, icon, label, onSave, onClose }: Props) {
  const [newIcon,  setNewIcon]  = useState(icon);
  const [newLabel, setNewLabel] = useState(label);

  const handleSave = () => {
    const trimmedLabel = newLabel.trim();
    if (!trimmedLabel) return;
    onSave(newIcon || icon, trimmedLabel);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="context-sheet edit-item-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <h3 className="edit-sheet-title">
          {kind === 'category' ? 'עריכת קטגוריה' : 'עריכת תת קטגוריה'}
        </h3>

        {/* Icon row */}
        <div className="edit-field-row">
          <span className="edit-field-label">אייקון</span>
          <input
            className="edit-icon-direct"
            type="text"
            inputMode="text"
            value={newIcon}
            onChange={(e) => {
              const val = e.target.value;
              setNewIcon(val === '' ? '' : extractEmoji(val));
            }}
            placeholder="🏷️"
            aria-label="אייקון"
          />
          <span className="edit-icon-hint">טאפ ← בחר אמוג׳י</span>
        </div>

        {/* Name row */}
        <div className="edit-field-row">
          <span className="edit-field-label">שם</span>
          <input
            className="edit-name-input"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={label}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
          />
        </div>

        <div className="edit-sheet-actions">
          <button className="modal-cancel" type="button" onClick={onClose}>ביטול</button>
          <button
            className="modal-save"
            type="button"
            onClick={handleSave}
            disabled={!newLabel.trim()}
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}
