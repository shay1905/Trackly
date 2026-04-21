import { useRef, useState } from 'react';
import { Subcategory, TransactionType } from '../types';
import { inferSubcategoryIcon } from '../utils/inferIcon';

interface Props {
  subcategories: Subcategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: (label: string, icon: string) => void;
  onItemMenu: (id: string) => void;
  onEnterEditMode: () => void;
  editMode: boolean;
  type: TransactionType;
  parentIcon: string;
  error?: string;
}

export default function SubcategoryRow({
  subcategories, selectedId, onSelect, onAdd,
  onItemMenu, onEnterEditMode, editMode,
  type, parentIcon, error,
}: Props) {
  const [adding,   setAdding]   = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [pressId,  setPressId]  = useState<string | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress   = useRef(false);

  const handlePointerDown = (id: string) => {
    if (editMode) return;
    didLongPress.current = false;
    setPressId(id);
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setPressId(null);
      onEnterEditMode();
    }, 480);
  };

  const handlePointerUp = (id: string) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setPressId(null);
    if (editMode || didLongPress.current) return;
    onSelect(id);
  };

  const cancelPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setPressId(null);
  };

  const liveIcon = newLabel.trim()
    ? inferSubcategoryIcon(newLabel, parentIcon)
    : (parentIcon || '🏷️');

  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    onAdd(trimmed, inferSubcategoryIcon(trimmed, parentIcon));
    setNewLabel('');
    setAdding(false);
  };

  return (
    <div className="subcategory-section">
      <div className={`sub-chip-row${editMode ? ' editing' : ''}`}>
        {subcategories.map((sub) => (
          <div
            key={sub.id}
            className="sub-cell"
          >
            <button
              className={[
                'sub-chip',
                sub.id === selectedId ? `selected ${type}` : '',
                pressId === sub.id ? 'pressing' : '',
              ].filter(Boolean).join(' ')}
              onPointerDown={() => handlePointerDown(sub.id)}
              onPointerUp={() => handlePointerUp(sub.id)}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
              type="button"
            >
              <div className="sub-chip-icon-wrap">
                <span className="sub-chip-icon">{sub.icon}</span>
              </div>
              <span className="sub-chip-label">{sub.label}</span>
            </button>

            {editMode && (
              <button
                className="item-settings-btn"
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onItemMenu(sub.id); }}
                aria-label={`אפשרויות עבור ${sub.label}`}
              >
                ✎
              </button>
            )}
          </div>
        ))}

        {!editMode && !adding && (
          <button className="sub-chip-add-btn" onClick={() => setAdding(true)} type="button">
            ＋
          </button>
        )}
      </div>

      {adding && (
        <div className="sub-add-row">
          <div className="sub-add-icon-preview">{liveIcon}</div>
          <input
            autoFocus
            className="sub-add-input"
            placeholder="שם תת קטגוריה"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewLabel(''); }
            }}
          />
          <button className="sub-add-confirm" onClick={handleAdd} type="button">✓</button>
          <button className="sub-add-cancel" onClick={() => { setAdding(false); setNewLabel(''); }} type="button">✕</button>
        </div>
      )}

      {error && <div className="field-error" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
