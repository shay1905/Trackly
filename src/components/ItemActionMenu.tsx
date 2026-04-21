interface Props {
  icon: string;
  label: string;
  isFirst: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
  onClose: () => void;
}

export default function ItemActionMenu({
  icon, label, isFirst,
  onEdit, onDelete, onMakeDefault, onClose,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="context-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        <div className="context-item-header">
          <div className="context-item-icon-wrap">
            <span>{icon}</span>
          </div>
          <span className="context-item-name">{label}</span>
        </div>

        <div className="action-menu-list">
          <button className="action-menu-btn" type="button" onClick={onEdit}>
            עריכה
          </button>
          {!isFirst && (
            <button className="action-menu-btn" type="button" onClick={onMakeDefault}>
              הגדר כברירת מחדל
            </button>
          )}
          <button className="action-menu-btn danger" type="button" onClick={onDelete}>
            מחיקה
          </button>
        </div>

        <button className="action-menu-cancel" type="button" onClick={onClose}>
          ביטול
        </button>
      </div>
    </div>
  );
}
