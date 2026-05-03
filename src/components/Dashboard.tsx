import { useState, useMemo } from 'react';
import { Transaction, Category, RecurringRule, NavFilters } from '../types';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  recurringRules: RecurringRule[];
  onNavigate?: (filters: NavFilters) => void;
}

type TimeFilter = '1m' | '3m' | '6m' | '12m' | 'all';
type TabType = 'monthly' | 'general';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: '1m',  label: 'החודש' },
  { key: '3m',  label: '3 חודשים' },
  { key: '6m',  label: '6 חודשים' },
  { key: '12m', label: '12 חודשים' },
  { key: 'all', label: 'הכל' },
];

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

function getStartDate(filter: TimeFilter): string | null {
  if (filter === 'all') return null;
  const now = new Date();
  const monthsBack = filter === '3m' ? 3 : filter === '6m' ? 6 : 12;
  // Integer arithmetic avoids toISOString() UTC-shift (e.g. Israel UTC+3 would turn Feb 1 → Jan 31)
  const totalMonths = now.getFullYear() * 12 + now.getMonth() - monthsBack;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12; // 0-indexed
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

function fmt(n: number): string {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 0 }) + ' ₪';
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

const NAV_BTN: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '20px', color: '#6b7280', padding: '0 6px', lineHeight: 1,
};

// ── Shared data type + builder ───────────────────────────────────────────
type CatRow = {
  label: string;
  icon: string;
  avg: number;
  pct: number;
  numericId: number | null;
  subcats: { label: string; icon: string; avg: number; pct: number; numericId: number | null }[];
};

function buildCatRows(
  txList: Transaction[],
  type: 'income' | 'expense',
  total: number,
  monthCount: number,
  categories: Category[],
): CatRow[] {
  const catKey    = (t: Transaction) => t.categoryNumericId != null ? `#${t.categoryNumericId}` : t.categoryLabel;
  const subcatKey = (t: Transaction) => t.subcategoryNumericId != null ? `#${t.subcategoryNumericId}` : t.subcategoryLabel;

  const catMeta    = new Map<string, { label: string; amount: number }>();
  const subcatMeta = new Map<string, Map<string, { label: string; amount: number; numericId: number | null }>>();

  txList.filter((t) => t.type === type).forEach((t) => {
    const ck = catKey(t);
    if (!catMeta.has(ck)) catMeta.set(ck, { label: t.categoryLabel, amount: 0 });
    catMeta.get(ck)!.amount += t.amount;
    if (t.subcategoryLabel) {
      const sk = subcatKey(t);
      if (!subcatMeta.has(ck)) subcatMeta.set(ck, new Map());
      const sm = subcatMeta.get(ck)!;
      if (!sm.has(sk)) sm.set(sk, { label: t.subcategoryLabel, amount: 0, numericId: t.subcategoryNumericId ?? null });
      sm.get(sk)!.amount += t.amount;
    }
  });

  return Array.from(catMeta.entries())
    .map(([ck, { label, amount: catTotal }]) => {
      const catObj  = categories.find((c) => c.label === label);
      const catIcon = catObj?.icon ?? '';
      return {
        label, icon: catIcon,
        avg: catTotal / monthCount,
        pct: total > 0 ? (catTotal / total) * 100 : 0,
        numericId: catObj?.numericId ?? null,
        subcats: Array.from((subcatMeta.get(ck) ?? new Map()).entries())
          .map(([, { label: sl, amount: sa, numericId: subNumericId }]) => ({
            label: sl,
            icon: catObj?.subcategories.find((s) => s.label === sl)?.icon || catIcon,
            avg: sa / monthCount,
            pct: catTotal > 0 ? (sa / catTotal) * 100 : 0,
            numericId: subNumericId,
          }))
          .sort((a, b) => b.avg - a.avg),
      };
    })
    .sort((a, b) => b.avg - a.avg);
}

const NAV_ARROW: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#d1d5db', fontSize: '18px', padding: '0', lineHeight: 1, flexShrink: 0,
};

// ── Reusable category list renderer ─────────────────────────────────────
function CategoryRows({
  rows,
  expandedCat,
  onToggle,
  subcatAmtColor,
  onNavigate,
}: {
  rows: CatRow[];
  expandedCat: string | null;
  onToggle: (label: string) => void;
  subcatAmtColor: string;
  onNavigate?: (catNumericId: number | null, subNumericId: number | null) => void;
}) {
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
      {rows.map(({ label, icon, avg, pct, subcats, numericId }, idx) => (
        <div key={label}>
          <div
            onClick={() => subcats.length > 0 && onToggle(label)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '13px 16px',
              cursor: subcats.length > 0 ? 'pointer' : 'default',
              borderTop: idx > 0 ? '1px solid #f9fafb' : 'none',
              background: expandedCat === label ? '#fafafa' : 'white',
            }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0, width: '26px', textAlign: 'center' }}>{icon}</span>
            <span style={{ flex: 1, fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>
              {label}
              {subcats.length > 0 && (
                <span style={{ fontSize: '10px', color: '#9ca3af', marginRight: '4px' }}>
                  {expandedCat === label ? ' ▴' : ' ▾'}
                </span>
              )}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{fmt(avg)}</span>
            <span style={{ fontSize: '12px', color: '#9ca3af', minWidth: '40px', textAlign: 'left' }}>{fmtPct(pct)}</span>
            {onNavigate && (
              <button
                type="button"
                style={NAV_ARROW}
                onClick={(e) => { e.stopPropagation(); onNavigate(numericId, null); }}
              >‹</button>
            )}
          </div>

          {expandedCat === label && subcats.map(({ label: sl, icon: si, avg: sa, pct: sp, numericId: subNumericId }) => (
            <div key={sl} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              paddingTop: '10px', paddingBottom: '10px',
              paddingRight: '36px', paddingLeft: '16px',
              borderTop: '1px solid #f3f4f6',
              background: '#f9fafb',
            }}>
              <span style={{ fontSize: '16px', flexShrink: 0, width: '22px', textAlign: 'center' }}>{si}</span>
              <span style={{ flex: 1, fontSize: '13px', color: '#6b7280' }}>{sl}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: subcatAmtColor }}>{fmt(sa)}</span>
              <span style={{ fontSize: '11px', color: '#9ca3af', minWidth: '40px', textAlign: 'left' }}>{fmtPct(sp)}</span>
              {onNavigate && (
                <button
                  type="button"
                  style={{ ...NAV_ARROW, fontSize: '16px' }}
                  onClick={() => onNavigate(numericId, subNumericId)}
                >‹</button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Savings rate trend chart (pure SVG, no libs) ─────────────────────────
function SavingsTrendChart({
  data,
  selectedIdx,
  onSelect,
}: {
  data: { month: string; rate: number }[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}) {
  if (data.length < 2) {
    return (
      <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '10px 0' }}>
        נדרשים לפחות 2 חודשים עם הכנסה
      </p>
    );
  }

  const W = 300, H = 72, PL = 10, PR = 10, PT = 12, PB = 10;
  const iW = W - PL - PR, iH = H - PT - PB;

  const rates = data.map((d) => d.rate);
  const maxR  = Math.max(...rates, 5);
  const minR  = Math.min(...rates, 0);
  const range = Math.max(maxR - minR, 5);

  const toX = (i: number) => PL + (i / (data.length - 1)) * iW;
  const toY = (r: number) => PT + (1 - (r - minR) / range) * iH;

  const pts      = data.map((d, i) => ({ ...d, x: toX(i), y: toY(d.rate) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const multiYear   = new Set(data.map((d) => d.month.slice(0, 4))).size > 1;
  const chartHeight = H + (multiYear ? 14 : 0);
  const sel         = selectedIdx !== null ? data[selectedIdx] : null;

  return (
    <div style={{ direction: 'ltr' }}>
      <svg viewBox={`0 0 ${W} ${chartHeight}`} style={{ width: '100%', display: 'block' }}>
        {/* dashed zero line when any month has negative savings */}
        {minR < 0 && (
          <line x1={PL} x2={W - PR} y1={toY(0).toFixed(1)} y2={toY(0).toFixed(1)}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4,3" />
        )}
        {/* connecting line */}
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
        {/* visible dots */}
        {pts.map((p, i) => (
          <circle key={i}
            cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
            r={selectedIdx === i ? 6 : 4}
            fill={p.rate >= 0 ? '#6366f1' : '#ef4444'}
            stroke="white" strokeWidth={selectedIdx === i ? 2.5 : 1.5}
          />
        ))}
        {/* transparent hit areas for easier tapping */}
        {pts.map((p, i) => (
          <circle key={`h${i}`}
            cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={14}
            fill="transparent" style={{ cursor: 'pointer' }}
            onClick={() => onSelect(i)}
          />
        ))}
        {/* year labels at boundaries (only when data spans multiple years) */}
        {multiYear && pts.map((p, i) =>
          (i === 0 || data[i].month.slice(5) === '01') ? (
            <text key={i} x={p.x.toFixed(1)} y={H + 12}
              textAnchor="middle" fontSize={9} fill="#9ca3af">
              {data[i].month.slice(0, 4)}
            </text>
          ) : null
        )}
      </svg>

      {/* Selected point info row */}
      {sel ? (
        <div style={{ direction: 'rtl', textAlign: 'center', marginTop: '8px', fontSize: '13px' }}>
          <span style={{ color: '#374151', fontWeight: 500 }}>{fmtMonthHe(sel.month)}</span>
          <span style={{ color: '#d1d5db', margin: '0 6px' }}>·</span>
          <span style={{ fontWeight: 600, color: sel.rate >= 0 ? '#6366f1' : '#ef4444' }}>
            {fmtPct(sel.rate)}
          </span>
        </div>
      ) : (
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#d1d5db', marginTop: '6px' }}>
          לחץ על נקודה לפרטים
        </p>
      )}
    </div>
  );
}

function getMonthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  let cur = start;
  while (cur <= end) {
    months.push(cur);
    const [y, m] = cur.split('-').map(Number);
    cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return months;
}

function buildVirtualItems(rules: RecurringRule[], months: string[]): Transaction[] {
  return rules.flatMap((r) =>
    months
      .filter((m) => r.isActive && r.startDate.slice(0, 7) <= m)
      .map((m) => {
        const [y, mo] = m.split('-').map(Number);
        const daysInMonth = new Date(y, mo, 0).getDate();
        const day = Math.min(r.dayOfMonth, daysInMonth);
        return {
          id: `virtual-${r.id}-${m}`,
          type: r.type,
          amount: r.amount,
          categoryLabel: r.categoryLabel,
          subcategoryLabel: r.subcategoryLabel,
          description: r.description,
          date: `${m}-${String(day).padStart(2, '0')}`,
          installments: 1,
          recurrence: 'monthly' as const,
          categoryNumericId: r.categoryNumericId,
          subcategoryNumericId: r.subcategoryNumericId,
          isVirtualRecurring: true,
          recurringRuleId: r.id,
        };
      })
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Dashboard({ transactions, categories, recurringRules, onNavigate }: Props) {
  const [activeTab,        setActiveTab]        = useState<TabType>('monthly');
  const [timeFilter,       setTimeFilter]       = useState<TimeFilter>('1m');
  const [specificMonth,    setSpecificMonth]    = useState<string>(currentMonthStr());
  const [expandedExpCat,   setExpandedExpCat]   = useState<string | null>(null);
  const [expandedIncCat,   setExpandedIncCat]   = useState<string | null>(null);
  const [selectedTrendIdx, setSelectedTrendIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const cm = currentMonthStr();
    // Transactions created by the sync effect for recurring rules have
    // recurrenceGroupId === rule.id. Exclude them here; buildVirtualItems
    // is the single source of truth for monthly recurring charges.
    const ruleIdSet = new Set(recurringRules.map((r) => r.id));
    const isRuleTx = (t: Transaction) =>
      t.recurrence === 'monthly' &&
      !!t.recurrenceGroupId &&
      !t.recurrenceTotal &&
      ruleIdSet.has(t.recurrenceGroupId!);

    let base: Transaction[];
    let virtualMonths: string[];

    if (timeFilter === '1m') {
      base = transactions.filter((t) => t.date.slice(0, 7) === specificMonth && !isRuleTx(t));
      virtualMonths = [specificMonth];
    } else if (timeFilter === 'all') {
      base = transactions.filter((t) => !isRuleTx(t));
      const earliest = [...base.map((t) => t.date.slice(0, 7)), ...recurringRules.map((r) => r.startDate.slice(0, 7))].sort()[0] ?? cm;
      virtualMonths = getMonthsInRange(earliest, cm);
    } else {
      const start = getStartDate(timeFilter)!;
      base = transactions.filter((t) => t.date >= start && !isRuleTx(t));
      virtualMonths = getMonthsInRange(start.slice(0, 7), cm);
    }

    const virtual = buildVirtualItems(recurringRules, virtualMonths);
    return [...base, ...virtual];
  }, [transactions, recurringRules, timeFilter, specificMonth]);

  const income   = useMemo(() => filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered]);
  const expenses = useMemo(() => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);
  const balance  = income - expenses;
  const savingsRate = income > 0 ? (balance / income) * 100 : null;

  const monthCount = useMemo(() => {
    if (timeFilter === '1m')  return 1;
    if (timeFilter === '3m')  return 3;
    if (timeFilter === '6m')  return 6;
    if (timeFilter === '12m') return 12;
    const months = new Set(filtered.map((t) => t.date.slice(0, 7)));
    return Math.max(months.size, 1);
  }, [timeFilter, filtered]);

  // For multi-month averages, exclude the current (partial) month so averages
  // are based only on complete calendar months.
  const cm = currentMonthStr();
  const filteredFull = useMemo(
    () => timeFilter === '1m' ? filtered : filtered.filter((t) => t.date.slice(0, 7) < cm),
    [filtered, timeFilter, cm],
  );
  const incomeFull   = useMemo(() => filteredFull.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filteredFull]);
  const expensesFull = useMemo(() => filteredFull.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filteredFull]);
  const fullMonthCount = useMemo(() => {
    if (timeFilter === '1m') return 1;
    const months = new Set(filteredFull.map((t) => t.date.slice(0, 7)));
    return Math.max(months.size, 1);
  }, [timeFilter, filteredFull]);

  const isMultiMonth    = monthCount > 1;
  const displayIncome   = isMultiMonth ? incomeFull   / fullMonthCount : income;
  const displayExpenses = isMultiMonth ? expensesFull / fullMonthCount : expenses;
  const displayBalance  = isMultiMonth ? (incomeFull - expensesFull) / fullMonthCount : balance;

  const catExpenses = useMemo(
    () => buildCatRows(filteredFull, 'expense', expensesFull, fullMonthCount, categories),
    [filteredFull, expensesFull, fullMonthCount, categories],
  );

  const catIncome = useMemo(
    () => buildCatRows(filteredFull, 'income', incomeFull, fullMonthCount, categories),
    [filteredFull, incomeFull, fullMonthCount, categories],
  );

  // Savings trend uses ALL transactions + virtual recurring items — unaffected by the time filter
  const savingsTrend = useMemo(() => {
    const map = new Map<string, { inc: number; exp: number }>();
    const addItem = (t: { type: string; amount: number; date: string }) => {
      const mo = t.date.slice(0, 7);
      if (!map.has(mo)) map.set(mo, { inc: 0, exp: 0 });
      const e = map.get(mo)!;
      if (t.type === 'income') e.inc += t.amount; else e.exp += t.amount;
    };
    transactions.forEach(addItem);
    if (recurringRules.length > 0) {
      const cm = currentMonthStr();
      const earliest = recurringRules.map((r) => r.startDate.slice(0, 7)).sort()[0];
      buildVirtualItems(recurringRules, getMonthsInRange(earliest, cm)).forEach(addItem);
    }
    const cm = currentMonthStr();
    return Array.from(map.entries())
      .filter(([month, { inc }]) => inc > 0 && month < cm)
      .map(([month, { inc, exp }]) => ({ month, rate: ((inc - exp) / inc) * 100 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions, recurringRules]);

  const today = currentMonthStr();

  const handleCatNavigate = (catNumericId: number | null, subNumericId: number | null) => {
    if (!onNavigate) return;
    onNavigate({
      catNumericId,
      subNumericId,
      dateFilter: timeFilter === '1m' ? 'this-month' : 'range',
      selectedMonth: specificMonth,
      rangeStart: timeFilter === '1m' ? null : getStartDate(timeFilter),
    });
  };

  const TABS: { key: TabType; label: string }[] = [
    { key: 'monthly', label: 'דוחות חודשיים' },
    { key: 'general', label: 'דוחות כלליים' },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">דשבורד</h2>
      </div>

      {/* Segmented tab control */}
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', margin: '0 0 16px', direction: 'rtl' }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, padding: '8px 0', border: 'none',
              borderRadius: '8px', fontSize: '13px',
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? '#1f2937' : '#9ca3af',
              background: activeTab === key ? 'white' : 'transparent',
              cursor: 'pointer',
              boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: דוחות חודשיים ───────────────────────────────── */}
      {activeTab === 'monthly' && (
        <>
          {/* Time filter */}
          <div className="dash-filter-row">
            {TIME_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`dash-filter-btn${timeFilter === f.key ? ' active' : ''}`}
                onClick={() => { setTimeFilter(f.key); setExpandedExpCat(null); setExpandedIncCat(null); }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Month navigator — only for 'החודש' */}
          {timeFilter === '1m' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '2px 0 10px', direction: 'ltr' }}>
              <button style={NAV_BTN} onClick={() => setSpecificMonth(prevMonth(specificMonth))}>‹</button>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151', background: '#f3f4f6', borderRadius: '20px', padding: '4px 16px' }}>
                {fmtMonthHe(specificMonth)}
              </span>
              <button
                style={{ ...NAV_BTN, color: specificMonth >= today ? '#d1d5db' : '#6b7280' }}
                onClick={() => specificMonth < today && setSpecificMonth(nextMonth(specificMonth))}
              >
                ›
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty-icon">📊</span>
              <p>אין נתונים לתקופה זו</p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                {isMultiMonth ? 'ממוצעים חודשיים' : 'סיכום חודשי'}
              </div>

              <div className="dash-cards">
                <div className="dash-card">
                  <span className="dash-card-label">הכנסות</span>
                  <span className="dash-card-value income">{fmt(displayIncome)}</span>
                </div>
                <div className="dash-card">
                  <span className="dash-card-label">הוצאות</span>
                  <span className="dash-card-value expense">{fmt(displayExpenses)}</span>
                </div>
                <div className="dash-card">
                  <span className="dash-card-label">יתרה</span>
                  <span className={`dash-card-value${displayBalance >= 0 ? ' income' : ' expense'}`}>{fmt(displayBalance)}</span>
                </div>
                <div className="dash-card">
                  <span className="dash-card-label">שיעור חיסכון</span>
                  <span className="dash-card-value">{savingsRate !== null ? fmtPct(savingsRate) : '—'}</span>
                </div>
              </div>

              {catExpenses.length > 0 && (
                <div className="dash-section">
                  <h3 className="dash-section-title">הוצאות לפי קטגוריה</h3>
                  <CategoryRows
                    rows={catExpenses}
                    expandedCat={expandedExpCat}
                    onToggle={(l) => setExpandedExpCat((p) => (p === l ? null : l))}
                    subcatAmtColor="#ef4444"
                    onNavigate={onNavigate ? handleCatNavigate : undefined}
                  />
                </div>
              )}

              {catIncome.length > 0 && (
                <div className="dash-section">
                  <h3 className="dash-section-title">הכנסות לפי קטגוריה</h3>
                  <CategoryRows
                    rows={catIncome}
                    expandedCat={expandedIncCat}
                    onToggle={(l) => setExpandedIncCat((p) => (p === l ? null : l))}
                    subcatAmtColor="#16a34a"
                    onNavigate={onNavigate ? handleCatNavigate : undefined}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Tab: דוחות כלליים ────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="dash-section">
          <h3 className="dash-section-title">מגמת שיעור חיסכון</h3>
          <SavingsTrendChart
            data={savingsTrend}
            selectedIdx={selectedTrendIdx}
            onSelect={(i) => setSelectedTrendIdx((p) => (p === i ? null : i))}
          />
        </div>
      )}
    </div>
  );
}
