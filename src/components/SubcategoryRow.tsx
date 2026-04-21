import { useRef, useState } from 'react';
import { Subcategory, TransactionType } from '../types';
import { inferSubcategoryIcon } from '../utils/inferIcon';

function extractEmoji(input: string): string {
  if (!input) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segs = [...new (Intl as typeof Intl & { Segmenter: new () => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter().segment(input)];
    return segs[segs.length - 1]?.segment ?? input;
  }
  return [...input].slice(-2).join('');
}

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
  const [adding,     setAdding]     = useState(false);
  const [newLabel,   setNewLabel]   = useState('');
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [pressId,    setPressId]    = useState<string | null>(null);

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

  const autoIcon = newLabel.trim()
    ? inferSubcategoryIcon(newLabel, parentIcon)
    : (parentIcon || '🏷️');
  const liveIcon = customIcon !== null ? customIcon : autoIcon;

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) { setCustomIcon(''); return; }
    setCustomIcon(extractEmoji(val) || val);
  };

  const resetAddForm = () => {
    setNewLabel('');
    setCustomIcon(null);
    setAdding(false);
  };

  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    onAdd(trimmed, liveIcon);
    resetAddForm();
  };

  const addForm = (
    <div className="sub-add-row">
      <input
        className="sub-add-icon-preview"
        type="text"
        inputMode="text"
        value={liveIcon}
        onChange={handleIconChange}
        onKeyDown={(e) => { if (e.key === 'Backspace') { setCustomIcon(''); e.preventDefault(); } }}
        aria-label="אייקון"
      />
      <input
        autoFocus
        className="sub-add-input"
        placeholder="שם תת קטגוריה"
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  handleAdd();
          if (e.key === 'Escape') resetAddForm();
        }}
      />
      <button className="sub-add-confirm" onClick={handleAdd} type="button">✓</button>
      <button className="sub-add-cancel" onClick={resetAddForm} type="button">✕</button>
    </div>
  );

  // Empty state: show a minimal add link instead of the full section
  if (subcategories.length === 0 && !editMode) {
    if (!adding) {
      return (
        <div className="sub-add-link-wrap">
          <button className="sub-add-link-btn" onClick={() => setAdding(true)} type="button">
            ＋ הוסף תת־קטגוריה
          </button>
        </div>
      );
    }
    return (
      <div className="sub-add-link-wrap">
        {addForm}
      </div>
    );
  }

  return (
    <div className="subcategory-section">
      <div className="sub-section-label">תתי קטגוריות</div>
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

      {adding && addForm}

      {error && <div className="field-error" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
