interface Props {
  icon: string;
  label: string;
  kind: 'category' | 'subcategory';
  onDelete: () => void;
  onClose: () => void;
}

export default function ItemContextMenu({ icon, label, kind, onDelete, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="context-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        {/* Item header */}
        <div className="context-item-header">
          <div className="context-item-icon-wrap">
            <span>{icon}</span>
          </div>
          <span className="context-item-name">{label}</span>
        </div>

        {/* Actions */}
        <button className="context-action-delete" onClick={onDelete} type="button">
          <span className="context-action-icon">🗑</span>
          <span>{kind === 'category' ? 'מחק קטגוריה' : 'מחק תת-קטגוריה'}</span>
        </button>

        <button className="context-action-cancel" onClick={onClose} type="button">
          ביטול
        </button>
      </div>
    </div>
  );
}
