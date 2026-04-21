import { useRef, useState } from 'react';
import { Category, TransactionType } from '../types';

interface Props {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  type: TransactionType;
  onAddCategory: () => void;
  onItemMenu: (id: string) => void;
  onEnterEditMode: () => void;
  editMode: boolean;
  showAddButton?: boolean;
  error?: string;
}

export default function CategoryGrid({
  categories, selectedId, onSelect, type,
  onAddCategory, onItemMenu,
  onEnterEditMode, editMode, showAddButton, error,
}: Props) {
  const [pressId,     setPressId]     = useState<string | null>(null);
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

  return (
    <div className="category-section">
      <div className={`category-grid${error ? ' has-error' : ''}${editMode ? ' editing' : ''}`}>
        {categories.map((cat) => (
          <div key={cat.id} className="cat-cell">
            <button
              className={[
                'category-btn',
                cat.id === selectedId ? `selected ${type}` : '',
                pressId === cat.id ? 'pressing' : '',
              ].filter(Boolean).join(' ')}
              onPointerDown={() => handlePointerDown(cat.id)}
              onPointerUp={() => handlePointerUp(cat.id)}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
              type="button"
            >
              <div className="cat-icon-wrap">
                <span className="cat-icon">{cat.icon}</span>
              </div>
              <span className="cat-label">{cat.label}</span>
            </button>

            {editMode && (
              <button
                className="item-settings-btn"
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onItemMenu(cat.id); }}
                aria-label={`אפשרויות עבור ${cat.label}`}
              >
                ✎
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <div className="field-error">{error}</div>}

      {showAddButton && !editMode && (
        <div className="cat-add-row">
          <button className="cat-add-link" onClick={onAddCategory} type="button">
            ＋ קטגוריה חדשה
          </button>
        </div>
      )}
    </div>
  );
}
