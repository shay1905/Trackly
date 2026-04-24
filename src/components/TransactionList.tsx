import { useRef, useState } from 'react';
import { Category, Transaction } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { useLongPress } from '../hooks/useLongPress';

function getDisplayIcon(t: Transaction, categories: Category[]): string {
  if (t.subcategoryId) {
    const cat = categories.find((c) => c.id === t.categoryId);
    const sub = cat?.subcategories.find((s) => s.id === t.subcategoryId);
    if (sub?.icon) return sub.icon;
  }
  return t.categoryIcon;
}

type DateFilter = 'until-today' | 'future' | 'last-30';

const FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'until-today', label: 'עד היום' },
  { value: 'future',      label: 'עתידיות' },
  { value: 'last-30',     label: '30 ימים אחרונים' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  'one-time': '', monthly: 'חודשי', weekly: 'שבועי', yearly: 'שנתי',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const existing = map.get(t.date);
    if (existing) existing.push(t);
    else map.set(t.date, [t]);
  }
  return Array.from(map.entries());
}

interface PendingDelete {
  kind: 'single' | 'group';
  id: string;
}

interface Popup {
  desc: string;
  y: number;
}

interface Props {
  transactions: Transaction[];
  categories: Category[];
  onDelete: (id: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export default function TransactionList({ transactions, categories, onDelete, onDeleteGroup }: Props) {
  const [filter,        setFilter]        = useState<DateFilter>('until-today');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [search,        setSearch]        = useState('');
  const [popup,         setPopup]         = useState<Popup | null>(null);
  const pointerYRef = useRef(0);
  const lp = useLongPress(500);

  const today     = todayStr();
  const thirtyAgo = daysAgoStr(30);

  const filtered = transactions
    .filter((t) => {
      switch (filter) {
        case 'until-today': return t.date <= today;
        case 'future':      return t.date > today;
        case 'last-30':     return t.date >= thirtyAgo && t.date <= today;
      }
    })
    .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      filter === 'future'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
    );

  const groups = groupByDate(filtered);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'single') onDelete(pendingDelete.id);
    else onDeleteGroup(pendingDelete.id);
    setPendingDelete(null);
  };

  const popupTop = popup
    ? Math.max(60, Math.min(popup.y - 30, window.innerHeight - 100))
    : 0;

  return (
    <div className="history-container">
      <div className="history-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`history-filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="history-search-wrap">
        <input
          className="history-search"
          type="text"
          placeholder="חיפוש לפי תיאור..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="history-search-clear" onClick={() => setSearch('')} type="button">✕</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">📭</div>
          <p>אין עסקאות בתצוגה זו</p>
        </div>
      ) : (
        <div className="history-list">
          {groups.map(([date, items]) => (
            <div key={date} className="history-group">
              <div className="history-date-label">{formatDate(date)}</div>
              {items.map((t) => {
                const recLabel      = RECURRENCE_LABELS[t.recurrence];
                const isInstallment = t.installmentTotal && t.installmentTotal > 1;
                const isRecurring   = t.recurrenceTotal  && t.recurrenceTotal  > 1;
                const groupId       = t.installmentGroupId ?? t.recurrenceGroupId;

                return (
                  <div
                    key={t.id}
                    className={`tx-item ${t.type}${lp.pressingId === t.id ? ' tx-pressing' : ''}`}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      if (!t.description) return;
                      pointerYRef.current = e.clientY;
                      lp.start(t.id, () => setPopup({ desc: t.description, y: pointerYRef.current }));
                    }}
                    onPointerUp={() => lp.cancel()}
                    onPointerCancel={() => lp.cancel()}
                    onPointerLeave={() => lp.cancel()}
                    onContextMenu={(e) => { if (t.description) e.preventDefault(); }}
                  >
                    <div className="tx-icon-wrap">
                      <span className="tx-icon">{getDisplayIcon(t, categories)}</span>
                    </div>
                    <div className="tx-info">
                      <div className="tx-category">
                        {t.categoryLabel}
                        {t.subcategoryLabel && (
                          <span className="tx-sub"> · {t.subcategoryLabel}</span>
                        )}
                      </div>
                      <div className="tx-badges">
                        {isInstallment && (
                          <span className="tx-badge installment-badge">
                            {t.installmentIndex}/{t.installmentTotal}
                          </span>
                        )}
                        {isRecurring && recLabel && (
                          <span className="tx-badge recurrence-badge">
                            {recLabel} {t.recurrenceIndex}/{t.recurrenceTotal}
                          </span>
                        )}
                        {!isInstallment && !isRecurring && recLabel && (
                          <span className="tx-badge">{recLabel}</span>
                        )}
                      </div>
                      {t.description && <div className="tx-desc">{t.description}</div>}
                    </div>
                    <div className="tx-right">
                      <div className={`tx-amount ${t.type}`}>
                        {t.type === 'income' ? '+' : '−'}
                        {t.amount.toLocaleString('he-IL')} ₪
                      </div>
                      <div className="tx-actions">
                        {groupId && (
                          <button
                            className="tx-delete-group"
                            onClick={() => setPendingDelete({ kind: 'group', id: groupId })}
                          >מחק סדרה</button>
                        )}
                        <button
                          className="tx-delete"
                          onClick={() => setPendingDelete({ kind: 'single', id: t.id })}
                        >✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {popup && (
        <div className="desc-popup-overlay" onClick={() => setPopup(null)}>
          <div className="desc-popup" style={{ top: popupTop }}>
            {popup.desc}
          </div>
        </div>
      )}

      {pendingDelete?.kind === 'single' && (
        <ConfirmDialog
          title="מחיקת דיווח"
          message="האם למחוק את הדיווח?"
          confirmLabel="מחק"
          cancelLabel="ביטול"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {pendingDelete?.kind === 'group' && (
        <ConfirmDialog
          title="מחיקת סדרה"
          message={'האם למחוק את כל הסדרה?\nפעולה זו תמחק את כל המופעים של החיוב.'}
          confirmLabel="מחק סדרה"
          cancelLabel="ביטול"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
