import { useState, useMemo } from 'react';
import { Category, Transaction, RecurringRule } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { useLongPress } from '../hooks/useLongPress';

function getDisplayIcon(t: Transaction, categories: Category[]): string {
  const cat = categories.find((c) => c.numericId === t.categoryNumericId);
  if (cat) {
    const sub = t.subcategoryNumericId != null
      ? cat.subcategories.find((s) => s.numericId === t.subcategoryNumericId)
      : undefined;
    if (sub?.icon) return sub.icon;
    if (cat.icon) return cat.icon;
  }
  return '🏷️';
}

function getRuleIcon(rule: RecurringRule, categories: Category[]): string {
  const cat = categories.find((c) => c.numericId === rule.categoryNumericId);
  if (cat) {
    const sub = rule.subcategoryNumericId != null
      ? cat.subcategories.find((s) => s.numericId === rule.subcategoryNumericId)
      : undefined;
    if (sub?.icon) return sub.icon;
    if (cat.icon) return cat.icon;
  }
  return '🏷️';
}

const HE_MONTHS = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

function currentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
function fmtMonthHe(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${HE_MONTHS[m - 1]} ${y}`;
}

type DateFilter = 'this-month' | 'until-today' | 'future';

const FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'this-month',  label: 'החודש' },
  { value: 'until-today', label: 'עד היום' },
  { value: 'future',      label: 'עתידיות' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  'one-time': '', monthly: 'חודשי', weekly: 'שבועי', yearly: 'שנתי',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
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

function groupByMonth(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const mo = t.date.slice(0, 7);
    const existing = map.get(mo);
    if (existing) existing.push(t);
    else map.set(mo, [t]);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function isRecurringRuleTx(t: Transaction): boolean {
  return t.recurrence === 'monthly' && !!t.recurrenceGroupId && !t.recurrenceTotal;
}

interface PendingDelete {
  kind: 'single' | 'group' | 'recurring-current' | 'recurring-rule';
  id: string;
  transaction?: Transaction;
  ruleId?: string;
}

interface EditState {
  amount: string;
  catNumId: number | null;
  subNumId: number | null;
  description: string;
  date: string;
}

interface EditRuleState {
  amount: string;
  catNumId: number | null;
  subNumId: number | null;
  description: string;
  startDate: string;
}

export interface GroupSafeUpdate {
  categoryNumericId: number | null;
  categoryLabel: string;
  subcategoryNumericId: number | null;
  subcategoryLabel: string;
  description: string;
}

interface Props {
  transactions: Transaction[];
  categories: Category[];
  recurringRules: RecurringRule[];
  onDelete: (id: string) => void;
  onDeleteGroup: (groupId: string, from: Transaction) => void;
  onUpdate: (t: Transaction) => void;
  onUpdateGroup: (groupId: string, current: Transaction, groupSafe: GroupSafeUpdate) => void;
  onUpdateRecurringRule: (rule: RecurringRule) => void;
  onDeactivateRecurringRule: (id: string) => void;
  onUpdateInstallmentDates: (groupId: string, current: Transaction, groupSafe: GroupSafeUpdate) => void;
}

const LABEL_STYLE = {
  fontSize: '13px', color: '#6b7280',
  display: 'block', marginBottom: '6px', textAlign: 'right' as const,
};

const INPUT_BASE = {
  width: '100%', boxSizing: 'border-box' as const,
  border: '1.5px solid #e5e7eb', borderRadius: '12px',
  padding: '13px 14px', fontSize: '15px',
  background: '#fafafa',
};

export default function TransactionList({
  transactions, categories, recurringRules,
  onDelete, onDeleteGroup, onUpdate, onUpdateGroup,
  onUpdateRecurringRule, onDeactivateRecurringRule,
  onUpdateInstallmentDates,
}: Props) {
  const [filter,          setFilter]          = useState<DateFilter>('this-month');
  const [selectedMonth,   setSelectedMonth]   = useState(currentMonthStr);
  const [pendingDelete,   setPendingDelete]   = useState<PendingDelete | null>(null);
  const [pendingRuleCancel, setPendingRuleCancel] = useState<string | null>(null);
  const [search,          setSearch]          = useState('');
  const [selectedCatId,   setSelectedCatId]   = useState<number | null>(null);
  const [selectedSubId,   setSelectedSubId]   = useState<number | null>(null);
  const [editingTx,       setEditingTx]       = useState<Transaction | null>(null);
  const [editState,       setEditState]       = useState<EditState | null>(null);
  const [saveAttempted,   setSaveAttempted]   = useState(false);
  const [pendingUpdate,   setPendingUpdate]   = useState<Transaction | null>(null);
  const [showGroupChoice, setShowGroupChoice] = useState(false);
  const [editingRule,     setEditingRule]     = useState<RecurringRule | null>(null);
  const [editRuleState,   setEditRuleState]   = useState<EditRuleState | null>(null);
  const [ruleSaveAttempted, setRuleSaveAttempted] = useState(false);

  const lp = useLongPress(500);

  const today = todayStr();
  const thisMonth = currentMonthStr();

  const uniqueCats = useMemo(() => {
    const seen = new Set<number>();
    const result: { numericId: number; label: string; icon: string }[] = [];
    for (const t of transactions) {
      if (t.categoryNumericId != null && !seen.has(t.categoryNumericId)) {
        seen.add(t.categoryNumericId);
        const cat = categories.find((c) => c.numericId === t.categoryNumericId);
        result.push({ numericId: t.categoryNumericId, label: t.categoryLabel, icon: cat?.icon ?? '🏷️' });
      }
    }
    return result;
  }, [transactions, categories]);

  const uniqueSubs = useMemo(() => {
    if (selectedCatId == null) return [];
    const seen = new Set<number>();
    const result: { numericId: number; label: string; icon: string }[] = [];
    for (const t of transactions) {
      if (t.categoryNumericId === selectedCatId && t.subcategoryNumericId != null && !seen.has(t.subcategoryNumericId)) {
        seen.add(t.subcategoryNumericId);
        const cat = categories.find((c) => c.numericId === t.categoryNumericId);
        const sub = cat?.subcategories.find((s) => s.numericId === t.subcategoryNumericId);
        result.push({ numericId: t.subcategoryNumericId, label: t.subcategoryLabel ?? '', icon: sub?.icon ?? '🏷️' });
      }
    }
    return result;
  }, [transactions, categories, selectedCatId]);

  const filtered = transactions
    .filter((t) => {
      switch (filter) {
        case 'this-month':  return t.date.startsWith(selectedMonth);
        case 'until-today': return t.date <= today;
        case 'future':      return t.date > today;
      }
    })
    .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
    .filter((t) => selectedCatId == null || t.categoryNumericId === selectedCatId)
    .filter((t) => selectedSubId == null || t.subcategoryNumericId === selectedSubId)
    .sort((a, b) =>
      filter === 'future'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
    );

  const groups = groupByDate(filtered);

  // Future installments — exclude rule-generated recurring transactions
  const futureTransactions = useMemo(
    () => transactions
      .filter((t) => t.date > today && !isRecurringRuleTx(t))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [transactions, today],
  );
  const futureByMonth = useMemo(() => groupByMonth(futureTransactions), [futureTransactions]);

  const futureRecurringRules = useMemo(() => {
    const dayNum = parseInt(today.split('-')[2], 10);
    return recurringRules.filter((r) => r.dayOfMonth < dayNum);
  }, [recurringRules, today]);

  // ── Delete ──────────────────────────────────────────────────────────────
  const confirmDelete = () => {
    if (!pendingDelete) return;
    switch (pendingDelete.kind) {
      case 'single':
        onDelete(pendingDelete.id);
        break;
      case 'group':
        if (pendingDelete.transaction) onDeleteGroup(pendingDelete.id, pendingDelete.transaction);
        break;
      case 'recurring-current':
        onDelete(pendingDelete.id);
        if (pendingDelete.ruleId) setPendingRuleCancel(pendingDelete.ruleId);
        break;
      case 'recurring-rule':
        onDeactivateRecurringRule(pendingDelete.id);
        break;
    }
    setPendingDelete(null);
  };

  // ── Edit transaction ─────────────────────────────────────────────────────
  function openEdit(t: Transaction) {
    const cat = categories.find((c) => c.numericId === t.categoryNumericId);
    let subNumId = t.subcategoryNumericId ?? null;
    if (subNumId == null && cat && cat.subcategories.length > 0) {
      const defSub = cat.defaultSubcategoryId
        ? cat.subcategories.find((s) => s.id === cat.defaultSubcategoryId)
        : cat.subcategories[0];
      subNumId = defSub?.numericId ?? null;
    }
    setEditingTx(t);
    setEditState({
      amount: String(t.amount),
      catNumId: t.categoryNumericId,
      subNumId,
      description: t.description,
      date: t.date,
    });
    setSaveAttempted(false);
  }

  function closeAll() {
    setEditingTx(null);
    setEditState(null);
    setPendingUpdate(null);
    setShowGroupChoice(false);
    setSaveAttempted(false);
  }

  function handleSavePress() {
    setSaveAttempted(true);
    if (!editingTx || !editState) return;
    const amount = parseFloat(editState.amount);
    if (isNaN(amount) || amount <= 0) return;

    const cat = categories.find((c) => c.numericId === editState.catNumId);
    const sub = cat?.subcategories.find((s) => s.numericId === editState.subNumId);

    const updatedTx: Transaction = {
      ...editingTx,
      amount,
      categoryNumericId: editState.catNumId,
      categoryLabel: cat?.label ?? editingTx.categoryLabel,
      subcategoryNumericId: editState.subNumId ?? null,
      subcategoryLabel: sub?.label ?? '',
      description: editState.description,
      date: editState.date,
    };

    if (isRecurringRuleTx(editingTx)) {
      const txMonth = editingTx.date.slice(0, 7);
      if (txMonth === thisMonth) {
        // Current month: update transaction AND recurring rule for future charges
        onUpdate(updatedTx);
        const rule = recurringRules.find((r) => r.id === editingTx.recurrenceGroupId);
        if (rule) {
          onUpdateRecurringRule({
            ...rule,
            amount: updatedTx.amount,
            categoryNumericId: updatedTx.categoryNumericId,
            categoryLabel: updatedTx.categoryLabel,
            subcategoryNumericId: updatedTx.subcategoryNumericId ?? null,
            subcategoryLabel: updatedTx.subcategoryLabel ?? '',
            description: updatedTx.description,
            dayOfMonth: new Date(updatedTx.date + 'T00:00:00').getDate(),
          });
        }
      }
      closeAll();
      return;
    }

    // Installment with changed date: redistribute dates for this + following
    if (editingTx.installmentGroupId && editState.date !== editingTx.date) {
      onUpdateInstallmentDates(editingTx.installmentGroupId, updatedTx, {
        categoryNumericId:    updatedTx.categoryNumericId,
        categoryLabel:        updatedTx.categoryLabel,
        subcategoryNumericId: updatedTx.subcategoryNumericId ?? null,
        subcategoryLabel:     updatedTx.subcategoryLabel ?? '',
        description:          updatedTx.description,
      });
      closeAll();
      return;
    }

    const groupId = editingTx.installmentGroupId ?? editingTx.recurrenceGroupId;
    if (groupId) {
      setPendingUpdate(updatedTx);
      setShowGroupChoice(true);
    } else {
      onUpdate(updatedTx);
      closeAll();
    }
  }

  // ── Edit recurring rule ──────────────────────────────────────────────────
  function openRuleEdit(rule: RecurringRule) {
    setEditingRule(rule);
    setEditRuleState({
      amount: String(rule.amount),
      catNumId: rule.categoryNumericId,
      subNumId: rule.subcategoryNumericId,
      description: rule.description,
      startDate: rule.startDate,
    });
    setRuleSaveAttempted(false);
  }

  function closeRuleEdit() {
    setEditingRule(null);
    setEditRuleState(null);
    setRuleSaveAttempted(false);
  }

  function handleRuleSavePress() {
    setRuleSaveAttempted(true);
    if (!editingRule || !editRuleState) return;
    const amount = parseFloat(editRuleState.amount);
    if (isNaN(amount) || amount <= 0) return;

    const cat = categories.find((c) => c.numericId === editRuleState.catNumId);
    const sub = cat?.subcategories.find((s) => s.numericId === editRuleState.subNumId);

    onUpdateRecurringRule({
      ...editingRule,
      amount,
      categoryNumericId: editRuleState.catNumId,
      categoryLabel: cat?.label ?? editingRule.categoryLabel,
      subcategoryNumericId: editRuleState.subNumId ?? null,
      subcategoryLabel: sub?.label ?? '',
      description: editRuleState.description,
      startDate: editRuleState.startDate,
      dayOfMonth: new Date(editRuleState.startDate + 'T00:00:00').getDate(),
    });
    closeRuleEdit();
  }

  // ── Derived edit state ───────────────────────────────────────────────────
  const amountNum    = editState ? parseFloat(editState.amount) : NaN;
  const isValidAmt   = !isNaN(amountNum) && amountNum > 0;
  const canSave      = isValidAmt && !!editState?.catNumId;
  const editCat      = editState ? categories.find((c) => c.numericId === editState.catNumId) : null;
  const editSubs     = editCat?.subcategories ?? [];

  const ruleAmountNum  = editRuleState ? parseFloat(editRuleState.amount) : NaN;
  const isValidRuleAmt = !isNaN(ruleAmountNum) && ruleAmountNum > 0;
  const editRuleCat    = editRuleState ? categories.find((c) => c.numericId === editRuleState.catNumId) : null;
  const editRuleSubs   = editRuleCat?.subcategories ?? [];

  const amountOrDateChanged = !!(
    pendingUpdate && editingTx && (
      pendingUpdate.amount !== editingTx.amount ||
      pendingUpdate.date   !== editingTx.date
    )
  );

  // ── Future view ──────────────────────────────────────────────────────────
  if (filter === 'future') {
    return (
      <div className="history-container">
        {/* Filters */}
        <div className="history-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`history-filter-btn${filter === f.value ? ' active' : ''}`}
              onClick={() => setFilter(f.value)}
              type="button"
            >{f.label}</button>
          ))}
        </div>

        {/* Section 1: תשלומים */}
        <div style={{ padding: '4px 16px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px', paddingTop: '8px' }}>
            תשלומים עתידיים
          </div>

          {futureTransactions.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '12px 0 20px' }}>
              אין תשלומים עתידיים
            </div>
          ) : (
            futureByMonth.map(([month, items]) => (
              <div key={month} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '12px', fontWeight: 600, color: '#6b7280',
                  marginBottom: '6px', padding: '0 2px',
                  textTransform: 'uppercase',
                }}>
                  {fmtMonthHe(month)}
                </div>
                {items.map((t) => {
                  const groupId = t.installmentGroupId ?? t.recurrenceGroupId;
                  const isInstallment = t.installmentTotal && t.installmentTotal > 1;
                  return (
                    <div
                      key={t.id}
                      className={`tx-item ${t.type}${lp.pressingId === t.id ? ' tx-pressing' : ''}`}
                      onPointerDown={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        lp.start(t.id, () => openEdit(t));
                      }}
                      onPointerUp={() => lp.cancel()}
                      onPointerCancel={() => lp.cancel()}
                      onPointerLeave={() => lp.cancel()}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <div className="tx-icon-wrap">
                        <span className="tx-icon">{getDisplayIcon(t, categories)}</span>
                      </div>
                      <div className="tx-info">
                        <div className="tx-category">
                          {t.categoryLabel}
                          {t.subcategoryLabel && <span className="tx-sub"> · {t.subcategoryLabel}</span>}
                        </div>
                        <div className="tx-badges">
                          {isInstallment && (
                            <span className="tx-badge installment-badge">
                              {t.installmentIndex}/{t.installmentTotal}
                            </span>
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
                              onClick={() => setPendingDelete({ kind: 'group', id: groupId, transaction: t })}
                            >מחק מהמופע הזה והלאה</button>
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
            ))
          )}

          {/* Section 2: חיובים קבועים */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '16px 0 8px', paddingTop: '4px', borderTop: '1px solid #f3f4f6' }}>
            חיובים קבועים
          </div>

          {futureRecurringRules.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '12px 0 20px' }}>
              אין חיובים קבועים פעילים
            </div>
          ) : (
            <div style={{ paddingBottom: '24px' }}>
              {futureRecurringRules.map((rule) => (
                <div
                  key={rule.id}
                  className="tx-item expense"
                  style={{ cursor: 'pointer' }}
                  onClick={() => openRuleEdit(rule)}
                >
                  <div className="tx-icon-wrap">
                    <span className="tx-icon">{getRuleIcon(rule, categories)}</span>
                  </div>
                  <div className="tx-info">
                    <div className="tx-category">
                      {rule.categoryLabel}
                      {rule.subcategoryLabel && <span className="tx-sub"> · {rule.subcategoryLabel}</span>}
                    </div>
                    <div className="tx-badges">
                      <span style={{ fontSize: '11px', background: '#ede9fe', color: '#7c3aed', borderRadius: '6px', padding: '2px 6px', fontWeight: 600 }}>חודשי</span>
                    </div>
                    {rule.description && <div className="tx-desc">{rule.description}</div>}
                  </div>
                  <div className="tx-right">
                    <div className="tx-amount expense">
                      −{rule.amount.toLocaleString('he-IL')} ₪
                    </div>
                    <div className="tx-actions">
                      <button
                        className="tx-delete"
                        onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'recurring-rule', id: rule.id }); }}
                      >✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirms */}
        {pendingDelete?.kind === 'single' && (
          <ConfirmDialog title="מחיקת דיווח" message="האם למחוק את הדיווח?" confirmLabel="מחק" cancelLabel="ביטול" danger onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
        )}
        {pendingDelete?.kind === 'group' && (
          <ConfirmDialog title="מחיקת סדרה" message={'למחוק מהמופע הזה והלאה?\nמופעים קודמים יישארו ללא שינוי.'} confirmLabel="מחק מהמופע הזה והלאה" cancelLabel="ביטול" danger onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
        )}
        {pendingDelete?.kind === 'recurring-rule' && (
          <ConfirmDialog title="ביטול חיוב קבוע" message="מחיקה זו תבטל חיובים עתידיים לחיוב קבוע זה" confirmLabel="בטל" cancelLabel="ביטול" danger onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
        )}

        {pendingRuleCancel && (
          <ConfirmDialog
            title="ביטול חיוב קבוע"
            message="לבטל גם חיובים עתידיים לחיוב קבוע זה?"
            confirmLabel="בטל חיובים עתידיים"
            cancelLabel="לא, רק העסקה"
            danger
            onConfirm={() => { onDeactivateRecurringRule(pendingRuleCancel); setPendingRuleCancel(null); }}
            onCancel={() => setPendingRuleCancel(null)}
          />
        )}

        {/* Transaction edit sheet */}
        {editingTx && editState && renderEditSheet()}

        {/* Recurring rule edit sheet */}
        {editingRule && editRuleState && renderRuleEditSheet()}
      </div>
    );
  }

  // ── Normal view (this-month / until-today) ───────────────────────────────
  function renderEditSheet() {
    if (!editingTx || !editState) return null;
    const isPastRecurring = isRecurringRuleTx(editingTx) && editingTx.date.slice(0, 7) < thisMonth;

    if (isPastRecurring) {
      return (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={closeAll}
        >
          <div
            style={{ background: 'white', width: '100%', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
              <span style={{ fontSize: '32px', lineHeight: '1' }}>{getDisplayIcon(editingTx, categories)}</span>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#1f2937' }}>{editingTx.categoryLabel}{editingTx.subcategoryLabel ? ` · ${editingTx.subcategoryLabel}` : ''}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: editingTx.type === 'expense' ? '#dc2626' : '#16a34a' }}>
                {editingTx.type === 'income' ? '+' : '−'}{editingTx.amount.toLocaleString('he-IL')} ₪
              </div>
              {editingTx.description && <div style={{ fontSize: '13px', color: '#6b7280' }}>{editingTx.description}</div>}
            </div>
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af', marginBottom: '20px', padding: '10px 16px', background: '#f9fafb', borderRadius: '10px' }}>
              עסקאות עבר של חיוב קבוע אינן ניתנות לעריכה
            </div>
            <button
              style={{ width: '100%', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '16px', fontWeight: 700, background: '#e5e7eb', color: '#374151', cursor: 'pointer' }}
              onClick={closeAll}
            >סגור</button>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        onClick={showGroupChoice ? undefined : closeAll}
      >
        <div
          style={{ background: 'white', width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '12px 20px 0', flexShrink: 0, position: 'relative' }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 12px' }} />
            <button style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px', lineHeight: '1' }} onClick={closeAll}>✕</button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginBottom: '14px' }}>
              <span style={{ fontSize: '32px', lineHeight: '1' }}>{getDisplayIcon(editingTx, categories)}</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>עריכת עסקה</div>
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px', background: editingTx.type === 'expense' ? '#fee2e2' : '#dcfce7', color: editingTx.type === 'expense' ? '#dc2626' : '#16a34a' }}>
                {editingTx.type === 'expense' ? 'הוצאה' : 'הכנסה'}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>סכום (₪)</label>
              <input
                type="number" inputMode="decimal"
                style={{ ...INPUT_BASE, fontSize: '22px', fontWeight: 500, textAlign: 'right', direction: 'ltr', background: 'white', border: `1.5px solid ${saveAttempted && !isValidAmt ? '#ef4444' : '#e5e7eb'}` }}
                value={editState.amount}
                onChange={(e) => setEditState((s) => s && ({ ...s, amount: e.target.value }))}
              />
              {saveAttempted && !isValidAmt && <div style={{ fontSize: '12px', color: '#ef4444', textAlign: 'right', marginTop: '5px' }}>נדרש סכום גדול מ-0</div>}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>קטגוריה</label>
              <select
                style={{ ...INPUT_BASE, direction: 'rtl' }}
                value={editState.catNumId ?? ''}
                onChange={(e) => {
                  const numId = e.target.value ? Number(e.target.value) : null;
                  const newCat = numId != null ? categories.find((c) => c.numericId === numId) : null;
                  const defSub = newCat?.subcategories.length
                    ? (newCat.defaultSubcategoryId ? newCat.subcategories.find((s) => s.id === newCat.defaultSubcategoryId) : newCat.subcategories[0])
                    : null;
                  setEditState((s) => s && ({ ...s, catNumId: numId, subNumId: defSub?.numericId ?? null }));
                }}
              >
                {categories
                  .filter((c) => (c as any).type === editingTx!.type)
                  .map((c) => (
                    <option key={c.numericId} value={c.numericId ?? ''}>{c.icon} {c.label}</option>
                  ))}
              </select>
            </div>

            {editSubs.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={LABEL_STYLE}>תת-קטגוריה</label>
                <select
                  style={{ ...INPUT_BASE, direction: 'rtl' }}
                  value={editState.subNumId ?? ''}
                  onChange={(e) => { const numId = e.target.value ? Number(e.target.value) : null; setEditState((s) => s && ({ ...s, subNumId: numId })); }}
                >
                  {editSubs.map((s) => (
                    <option key={s.numericId} value={s.numericId ?? ''}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>תיאור</label>
              <textarea
                style={{ ...INPUT_BASE, resize: 'none', minHeight: '72px', direction: 'rtl', fontFamily: 'inherit', textAlign: 'right' }}
                value={editState.description}
                onChange={(e) => setEditState((s) => s && ({ ...s, description: e.target.value }))}
                placeholder="תיאור (אופציונלי)"
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>
                {editingTx.installmentGroupId ? 'תאריך תשלום ראשון מהעסקה הזו והלאה' : 'תאריך'}
              </label>
              <input
                type="date"
                style={{ ...INPUT_BASE, direction: 'ltr' }}
                value={editState.date}
                onChange={(e) => setEditState((s) => s && ({ ...s, date: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ padding: '12px 20px 28px', flexShrink: 0 }}>
            <button
              style={{ width: '100%', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '16px', fontWeight: 700, background: canSave ? '#2563eb' : '#e5e7eb', color: canSave ? 'white' : '#9ca3af', cursor: canSave ? 'pointer' : 'not-allowed', marginBottom: '8px' }}
              onClick={handleSavePress}
              disabled={!canSave}
            >שמור שינויים</button>
            <button style={{ width: '100%', background: 'none', border: 'none', color: '#6b7280', fontSize: '15px', cursor: 'pointer', padding: '8px' }} onClick={closeAll}>ביטול</button>
          </div>
        </div>
      </div>
    );
  }

  function renderRuleEditSheet() {
    if (!editingRule || !editRuleState) return null;
    const ruleIcon = getRuleIcon(editingRule, categories);
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        onClick={closeRuleEdit}
      >
        <div
          style={{ background: 'white', width: '100%', borderRadius: '20px 20px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '12px 20px 0', flexShrink: 0, position: 'relative' }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 12px' }} />
            <button style={{ position: 'absolute', top: '12px', right: '16px', background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px', lineHeight: '1' }} onClick={closeRuleEdit}>✕</button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginBottom: '14px' }}>
              <span style={{ fontSize: '32px', lineHeight: '1' }}>{ruleIcon}</span>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>עריכת חיוב קבוע</div>
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px', background: '#ede9fe', color: '#7c3aed' }}>חודשי קבוע</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>סכום (₪)</label>
              <input
                type="number" inputMode="decimal"
                style={{ ...INPUT_BASE, fontSize: '22px', fontWeight: 500, textAlign: 'right', direction: 'ltr', background: 'white', border: `1.5px solid ${ruleSaveAttempted && !isValidRuleAmt ? '#ef4444' : '#e5e7eb'}` }}
                value={editRuleState.amount}
                onChange={(e) => setEditRuleState((s) => s && ({ ...s, amount: e.target.value }))}
              />
              {ruleSaveAttempted && !isValidRuleAmt && <div style={{ fontSize: '12px', color: '#ef4444', textAlign: 'right', marginTop: '5px' }}>נדרש סכום גדול מ-0</div>}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>קטגוריה</label>
              <select
                style={{ ...INPUT_BASE, direction: 'rtl' }}
                value={editRuleState.catNumId ?? ''}
                onChange={(e) => {
                  const numId = e.target.value ? Number(e.target.value) : null;
                  const newCat = numId != null ? categories.find((c) => c.numericId === numId) : null;
                  const defSub = newCat?.subcategories.length
                    ? (newCat.defaultSubcategoryId ? newCat.subcategories.find((s) => s.id === newCat.defaultSubcategoryId) : newCat.subcategories[0])
                    : null;
                  setEditRuleState((s) => s && ({ ...s, catNumId: numId, subNumId: defSub?.numericId ?? null }));
                }}
              >
                {categories
                  .filter((c) => (c as any).type === editingRule!.type)
                  .map((c) => (
                    <option key={c.numericId} value={c.numericId ?? ''}>{c.icon} {c.label}</option>
                  ))}
              </select>
            </div>

            {editRuleSubs.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={LABEL_STYLE}>תת-קטגוריה</label>
                <select
                  style={{ ...INPUT_BASE, direction: 'rtl' }}
                  value={editRuleState.subNumId ?? ''}
                  onChange={(e) => { const numId = e.target.value ? Number(e.target.value) : null; setEditRuleState((s) => s && ({ ...s, subNumId: numId })); }}
                >
                  {editRuleSubs.map((s) => (
                    <option key={s.numericId} value={s.numericId ?? ''}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>תיאור</label>
              <textarea
                style={{ ...INPUT_BASE, resize: 'none', minHeight: '72px', direction: 'rtl', fontFamily: 'inherit', textAlign: 'right' }}
                value={editRuleState.description}
                onChange={(e) => setEditRuleState((s) => s && ({ ...s, description: e.target.value }))}
                placeholder="תיאור (אופציונלי)"
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={LABEL_STYLE}>תאריך התחלה</label>
              <input
                type="date"
                style={{ ...INPUT_BASE, direction: 'ltr' }}
                value={editRuleState.startDate}
                onChange={(e) => setEditRuleState((s) => s && ({ ...s, startDate: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ padding: '12px 20px 28px', flexShrink: 0 }}>
            <button
              style={{
                width: '100%', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '16px', fontWeight: 700,
                background: isValidRuleAmt ? '#2563eb' : '#e5e7eb',
                color: isValidRuleAmt ? 'white' : '#9ca3af',
                cursor: isValidRuleAmt ? 'pointer' : 'not-allowed',
                marginBottom: '8px',
              }}
              onClick={handleRuleSavePress}
              disabled={!isValidRuleAmt}
            >שמור שינויים</button>
            <button style={{ width: '100%', background: 'none', border: 'none', color: '#6b7280', fontSize: '15px', cursor: 'pointer', padding: '8px' }} onClick={closeRuleEdit}>ביטול</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">

      {/* ── Filters ── */}
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

      {filter === 'this-month' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '2px 0 10px', direction: 'ltr' }}>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280', padding: '0 6px', lineHeight: '1' }}
            onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
          >‹</button>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151', background: '#f3f4f6', borderRadius: '20px', padding: '4px 16px' }}>
            {fmtMonthHe(selectedMonth)}
          </span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '0 6px', lineHeight: '1', color: '#6b7280' }}
            onClick={() => setSelectedMonth(nextMonth(selectedMonth))}
          >›</button>
        </div>
      )}

      {/* ── Search ── */}
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

      {/* ── Category chips ── */}
      {uniqueCats.length > 0 && (
        <div className="cat-chip-row">
          <button
            className={`cat-chip${selectedCatId == null ? ' active' : ''}`}
            onClick={() => { setSelectedCatId(null); setSelectedSubId(null); }}
            type="button"
          >הכל</button>
          {uniqueCats.map((c) => (
            <button
              key={c.numericId}
              className={`cat-chip${selectedCatId === c.numericId ? ' active' : ''}`}
              onClick={() => { setSelectedCatId(c.numericId); setSelectedSubId(null); }}
              type="button"
            >{c.icon} {c.label}</button>
          ))}
        </div>
      )}

      {uniqueSubs.length > 0 && (
        <div className="cat-chip-row sub">
          {uniqueSubs.map((s) => (
            <button
              key={s.numericId}
              className={`cat-chip sub${selectedSubId === s.numericId ? ' active' : ''}`}
              onClick={() => setSelectedSubId((prev) => prev === s.numericId ? null : s.numericId)}
              type="button"
            >{s.icon} {s.label}</button>
          ))}
        </div>
      )}

      {/* ── Transaction list ── */}
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
                const ruleTx      = isRecurringRuleTx(t);
                const recLabel    = RECURRENCE_LABELS[t.recurrence];
                const isInstallment = t.installmentTotal && t.installmentTotal > 1;
                const isRecurring   = t.recurrenceTotal  && t.recurrenceTotal  > 1;
                const groupId       = ruleTx ? undefined : (t.installmentGroupId ?? t.recurrenceGroupId);

                const handleDelete = () => {
                  if (ruleTx) {
                    const txMonth = t.date.slice(0, 7);
                    if (txMonth < thisMonth) {
                      // Past generated recurring tx: delete only this row, no rule question
                      setPendingDelete({ kind: 'single', id: t.id });
                    } else {
                      // Current month: delete tx + offer future cancellation
                      setPendingDelete({ kind: 'recurring-current', id: t.id, ruleId: t.recurrenceGroupId });
                    }
                  } else {
                    setPendingDelete({ kind: 'single', id: t.id });
                  }
                };

                return (
                  <div
                    key={t.id}
                    className={`tx-item ${t.type}${lp.pressingId === t.id ? ' tx-pressing' : ''}`}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      lp.start(t.id, () => openEdit(t));
                    }}
                    onPointerUp={() => lp.cancel()}
                    onPointerCancel={() => lp.cancel()}
                    onPointerLeave={() => lp.cancel()}
                    onContextMenu={(e) => e.preventDefault()}
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
                        {ruleTx && (
                          <span style={{ fontSize: '11px', background: '#ede9fe', color: '#7c3aed', borderRadius: '6px', padding: '2px 6px', fontWeight: 600 }}>
                            חודשי
                          </span>
                        )}
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
                        {!isInstallment && !isRecurring && !ruleTx && recLabel && (
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
                            onClick={() => setPendingDelete({ kind: 'group', id: groupId, transaction: t })}
                          >מחק מהמופע הזה והלאה</button>
                        )}
                        <button
                          className="tx-delete"
                          onClick={handleDelete}
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

      {/* ── Delete confirms ── */}
      {pendingDelete?.kind === 'single' && (
        <ConfirmDialog title="מחיקת דיווח" message="האם למחוק את הדיווח?" confirmLabel="מחק" cancelLabel="ביטול" danger onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      )}

      {pendingDelete?.kind === 'group' && (
        <ConfirmDialog title="מחיקת סדרה" message={'למחוק מהמופע הזה והלאה?\nמופעים קודמים יישארו ללא שינוי.'} confirmLabel="מחק מהמופע הזה והלאה" cancelLabel="ביטול" danger onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      )}

      {pendingDelete?.kind === 'recurring-current' && (
        <ConfirmDialog title="מחיקת דיווח" message="האם למחוק את הדיווח?" confirmLabel="מחק" cancelLabel="ביטול" danger onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      )}

      {pendingRuleCancel && (
        <ConfirmDialog
          title="ביטול חיוב קבוע"
          message="לבטל גם חיובים עתידיים לחיוב קבוע זה?"
          confirmLabel="בטל חיובים עתידיים"
          cancelLabel="לא, רק העסקה"
          danger
          onConfirm={() => { onDeactivateRecurringRule(pendingRuleCancel); setPendingRuleCancel(null); }}
          onCancel={() => setPendingRuleCancel(null)}
        />
      )}

      {/* ── Edit transaction sheet ── */}
      {editingTx && editState && renderEditSheet()}

      {/* ── Recurring rule edit sheet ── */}
      {editingRule && editRuleState && renderRuleEditSheet()}

      {/* ── Group choice dialog ── */}
      {showGroupChoice && pendingUpdate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => { setShowGroupChoice(false); setPendingUpdate(null); }}
        >
          <div
            style={{ background: 'white', borderRadius: '18px', padding: '24px 20px 20px', width: '100%', maxWidth: '340px', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', textAlign: 'center', marginBottom: '16px', lineHeight: '1.4' }}>
              לעדכן עסקה אחת או את כל הקבוצה?
            </div>

            {amountOrDateChanged && (
              <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '10px', padding: '10px 13px', fontSize: '13px', color: '#92400e', marginBottom: '16px', lineHeight: '1.6', textAlign: 'right' }}>
                סכום ותאריך יעודכנו רק בעסקה הנוכחית. קטגוריה, תת קטגוריה ותיאור יעודכנו בכל הקבוצה.
              </div>
            )}

            <button
              style={{ width: '100%', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 600, background: '#2563eb', color: 'white', cursor: 'pointer', marginBottom: '10px' }}
              onClick={() => { onUpdate(pendingUpdate); closeAll(); }}
            >רק העסקה הזו</button>

            <button
              style={{ width: '100%', border: '1.5px solid #2563eb', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: 600, background: 'white', color: '#2563eb', cursor: 'pointer', marginBottom: '10px' }}
              onClick={() => {
                const groupId = editingTx?.installmentGroupId ?? editingTx?.recurrenceGroupId;
                if (!groupId) return;
                onUpdateGroup(groupId, pendingUpdate, {
                  categoryNumericId:    pendingUpdate.categoryNumericId,
                  categoryLabel:        pendingUpdate.categoryLabel,
                  subcategoryNumericId: pendingUpdate.subcategoryNumericId ?? null,
                  subcategoryLabel:     pendingUpdate.subcategoryLabel ?? '',
                  description:          pendingUpdate.description,
                });
                closeAll();
              }}
            >כל הקבוצה</button>

            <button
              style={{ width: '100%', background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', padding: '8px' }}
              onClick={() => { setShowGroupChoice(false); setPendingUpdate(null); }}
            >ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}
