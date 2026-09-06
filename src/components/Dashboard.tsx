import { useState, useMemo } from 'react';
import { Transaction, Category, RecurringRule, NavFilters } from '../types';
import { currentMonthStr, getStartDate as getStartDateFor, filterToFullMonths, computeSavingsRate } from '../utils/reportMath';
import { resolveCategory } from '../utils/resolveCategory';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  recurringRules: RecurringRule[];
  onNavigate?: (filters: NavFilters) => void;
}

type TimeFilter = '1m' | '3m' | '6m' | '12m' | 'all' | 'custom';
type TabType = 'monthly' | 'general';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: '1m',     label: 'החודש' },
  { key: '3m',     label: '3 חודשים' },
  { key: '6m',     label: '6 חודשים' },
  { key: '12m',    label: '12 חודשים' },
  { key: 'all',    label: 'הכל' },
  { key: 'custom', label: 'טווח מותאם' },
];

const HE_MONTHS = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

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
  const monthsBack = filter === '3m' ? 3 : filter === '6m' ? 6 : 12;
  return getStartDateFor(monthsBack);
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
  groupKey: string;
  label: string;
  icon: string;
  avg: number;
  pct: number;
  numericId: number | null;
  subcats: { groupKey: string; label: string; icon: string; avg: number; pct: number; numericId: number | null }[];
};

function buildCatRows(
  txList: Transaction[],
  type: 'income' | 'expense',
  total: number,
  monthCount: number,
  categories: Category[],
): CatRow[] {
  // Identity comes from the LIVE categories tree (by numeric id), never from the
  // frozen categoryLabel copy stored on each transaction — so a rename merges
  // under the new name and a deleted subcategory disappears from the report.
  type CatEntry = { key: string; label: string; icon: string; numericId: number | null; amount: number };
  type SubEntry = { key: string; label: string; icon: string; numericId: number | null; amount: number };

  const catMeta    = new Map<string, CatEntry>();
  const subcatMeta = new Map<string, Map<string, SubEntry>>();

  txList.filter((t) => t.type === type).forEach((t) => {
    const r = resolveCategory(t, categories);
    // Resolve every transaction to ONE canonical live category so a single
    // category can never be split across several rows. Match the numeric id
    // first (type-guarded, so an expense never lands on income "מתנות"), then
    // fall back to a label+type match — a stale / removed / mis-linked id then
    // still merges with its live-label siblings instead of forming a 2nd row.
    const catObj =
      (t.categoryNumericId != null
        ? categories.find((c) => c.numericId === t.categoryNumericId && (c.type === type || c.type === 'both'))
        : undefined)
      ?? categories.find((c) => c.label === r.categoryLabel && (c.type === type || c.type === 'both'));
    const catKey = catObj?.numericId != null ? `id:${catObj.numericId}` : `label:${r.categoryLabel}`;

    if (!catMeta.has(catKey)) {
      catMeta.set(catKey, {
        key: catKey,
        label: catObj?.label ?? r.categoryLabel,
        icon: catObj?.icon ?? '',
        numericId: catObj?.numericId ?? t.categoryNumericId ?? null,
        amount: 0,
      });
    }
    catMeta.get(catKey)!.amount += t.amount;

    // A deleted subcategory still counts toward its category total but is never
    // shown as its own row (r.subcategoryMissing).
    if (!r.subcategoryMissing && r.subcategoryLabel) {
      if (!subcatMeta.has(catKey)) subcatMeta.set(catKey, new Map());
      const sm = subcatMeta.get(catKey)!;
      // Same canonicalisation as the category level: collapse a subcategory
      // referenced by id in some rows and only by label in others.
      const liveSub = catObj?.subcategories.find(
        (s) => (t.subcategoryNumericId != null && s.numericId === t.subcategoryNumericId) || s.label === r.subcategoryLabel,
      );
      const subKey = liveSub?.numericId != null ? `id:${liveSub.numericId}` : `label:${r.subcategoryLabel}`;
      if (!sm.has(subKey)) {
        sm.set(subKey, {
          key: subKey,
          label: r.subcategoryLabel,
          icon: r.subcategoryIcon || (catObj?.icon ?? ''),
          numericId: liveSub?.numericId ?? t.subcategoryNumericId ?? null,
          amount: 0,
        });
      }
      sm.get(subKey)!.amount += t.amount;
    }
  });

  return Array.from(catMeta.values())
    .map(({ key, label, icon, numericId, amount: catTotal }) => ({
      groupKey: key,
      label, icon,
      avg: catTotal / monthCount,
      pct: total > 0 ? (catTotal / total) * 100 : 0,
      numericId,
      subcats: Array.from((subcatMeta.get(key) ?? new Map<string, SubEntry>()).values())
        .map(({ key: subGroupKey, label: sl, icon: si, numericId: subNumericId, amount: sa }) => ({
          groupKey: subGroupKey,
          label: sl,
          icon: si || icon,
          avg: sa / monthCount,
          pct: catTotal > 0 ? (sa / catTotal) * 100 : 0,
          numericId: subNumericId,
        }))
        .sort((a, b) => b.avg - a.avg),
    }))
    .sort((a, b) => b.avg - a.avg);
}

const HOUSING_LABELS = new Set([
  'דיור', 'שכירות', 'חשמל', 'מים', 'גז', 'אינטרנט',
  'ארנונה', 'תחזוקת בית', 'אחזקת בית', 'ביטוח בית',
  'ועד בית', 'כלל הוצאות הבית', 'הוצאות דיור',
  'שכ"ד', 'שכד',
]);

const LOAN_LABELS = new Set([
  'החזר הלוואה', 'הלוואה', 'החזרי הלוואות', 'החזר משכנתא', 'משכנתא',
]);

function withSectionPct(rows: CatRow[]): CatRow[] {
  const sectionAvg = rows.reduce((s, r) => s + r.avg, 0);
  return rows.map((r) => ({ ...r, pct: sectionAvg > 0 ? (r.avg / sectionAvg) * 100 : 0 }));
}

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
  onNavigate?: (catNumericId: number | null, catLabel: string, subNumericId: number | null) => void;
}) {
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
      {rows.map(({ groupKey, label, icon, avg, pct, subcats, numericId }, idx) => (
        <div key={groupKey}>
          <div
            style={{
              display: 'flex', alignItems: 'center',
              borderTop: idx > 0 ? '1px solid #f9fafb' : 'none',
              background: expandedCat === label ? '#fafafa' : 'white',
            }}
          >
            {/* Row body: icon + label + amount + pct — clicks expand/collapse */}
            <div
              onClick={() => subcats.length > 0 && onToggle(label)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', flex: 1,
                padding: '13px 10px 13px 16px',
                cursor: subcats.length > 0 ? 'pointer' : 'default',
              }}
            >
              <span style={{ fontSize: '20px', flexShrink: 0, width: '26px', textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1, fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>
                {label}
                {subcats.length > 0 && (
                  <span style={{ fontSize: '10px', color: '#9ca3af', marginRight: '4px', padding: '0 3px' }}>
                    {expandedCat === label ? '▴' : '▾'}
                  </span>
                )}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', flexShrink: 0 }}>{fmt(avg)}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af', minWidth: '34px', textAlign: 'left', flexShrink: 0 }}>{fmtPct(pct)}</span>
            </div>
            {/* Navigation icon — separate action to go to Transactions */}
            {onNavigate && (
              <div onClick={() => onNavigate(numericId, label, null)} className="cat-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            )}
          </div>

          {expandedCat === label && subcats.map(({ groupKey: subGroupKey, label: sl, icon: si, avg: sa, pct: sp, numericId: subNumericId }) => (
            <div
              key={subGroupKey}
              style={{
                display: 'flex', alignItems: 'center',
                borderTop: '1px solid #f3f4f6',
                background: '#f9fafb',
              }}
            >
              {/* Row body: icon + label + amount + pct */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, padding: '10px 10px 10px 36px' }}>
                <span style={{ fontSize: '16px', flexShrink: 0, width: '22px', textAlign: 'center' }}>{si}</span>
                <span style={{ flex: 1, fontSize: '13px', color: '#6b7280' }}>{sl}</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: subcatAmtColor, flexShrink: 0 }}>{fmt(sa)}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af', minWidth: '34px', textAlign: 'left', flexShrink: 0 }}>{fmtPct(sp)}</span>
              </div>
              {/* Navigation icon */}
              {onNavigate && (
                <div onClick={() => onNavigate(numericId, label, subNumericId)} className="cat-nav-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
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

// ── Compact single-month stepper (used by the custom range selector) ─────
function MonthStepper({ label, value, min, max, onChange }: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (v: string) => void;
}) {
  const canPrev = value > min;
  const canNext = value < max;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', direction: 'ltr' }}>
      <button
        style={{ ...NAV_BTN, fontSize: '18px', color: canPrev ? '#6b7280' : '#d1d5db', cursor: canPrev ? 'pointer' : 'default' }}
        onClick={() => canPrev && onChange(prevMonth(value))}
      >
        ‹
      </button>
      <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', background: '#f3f4f6', borderRadius: '20px', padding: '4px 12px', whiteSpace: 'nowrap', direction: 'rtl' }}>
        <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '5px' }}>{label}</span>
        {fmtMonthHe(value)}
      </span>
      <button
        style={{ ...NAV_BTN, fontSize: '18px', color: canNext ? '#6b7280' : '#d1d5db', cursor: canNext ? 'pointer' : 'default' }}
        onClick={() => canNext && onChange(nextMonth(value))}
      >
        ›
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function Dashboard({ transactions, categories, recurringRules, onNavigate }: Props) {
  const [activeTab,        setActiveTab]        = useState<TabType>('monthly');
  const [timeFilter,       setTimeFilter]       = useState<TimeFilter>('1m');
  const [specificMonth,    setSpecificMonth]    = useState<string>(currentMonthStr());
  const [customStart,      setCustomStart]      = useState<string>(() => getStartDateFor(5)!.slice(0, 7));
  const [customEnd,        setCustomEnd]        = useState<string>(() => currentMonthStr());
  const [expandedExpCat,   setExpandedExpCat]   = useState<string | null>(null);
  const [expandedIncCat,   setExpandedIncCat]   = useState<string | null>(null);
  const [selectedTrendIdx, setSelectedTrendIdx] = useState<number | null>(null);

  // Normalised custom range bounds (YYYY-MM, inclusive) — always lo <= hi.
  const cRangeLo = customStart <= customEnd ? customStart : customEnd;
  const cRangeHi = customStart <= customEnd ? customEnd : customStart;

  // Earliest month with any data — lower bound for the custom start stepper.
  const earliestMonth = useMemo(() => {
    const ms = [
      ...transactions.map((t) => t.date.slice(0, 7)),
      ...recurringRules.map((r) => r.startDate.slice(0, 7)),
    ].sort();
    return ms[0] ?? getStartDateFor(12)!.slice(0, 7);
  }, [transactions, recurringRules]);

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
    } else if (timeFilter === 'custom') {
      const start = `${cRangeLo}-01`;
      const endExclusive = `${nextMonth(cRangeHi)}-01`;
      base = transactions.filter((t) => t.date >= start && t.date < endExclusive && !isRuleTx(t));
      virtualMonths = getMonthsInRange(cRangeLo, cRangeHi);
    } else {
      const start = getStartDate(timeFilter)!;
      base = transactions.filter((t) => t.date >= start && !isRuleTx(t));
      virtualMonths = getMonthsInRange(start.slice(0, 7), cm);
    }

    const virtual = buildVirtualItems(recurringRules, virtualMonths);
    return [...base, ...virtual];
  }, [transactions, recurringRules, timeFilter, specificMonth, cRangeLo, cRangeHi]);

  const income   = useMemo(() => filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filtered]);
  const expenses = useMemo(() => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);
  const balance  = income - expenses;

  const monthCount = useMemo(() => {
    if (timeFilter === '1m')  return 1;
    if (timeFilter === '3m')  return 3;
    if (timeFilter === '6m')  return 6;
    if (timeFilter === '12m') return 12;
    if (timeFilter === 'custom') return getMonthsInRange(cRangeLo, cRangeHi).length;
    const months = new Set(filtered.map((t) => t.date.slice(0, 7)));
    return Math.max(months.size, 1);
  }, [timeFilter, filtered, cRangeLo, cRangeHi]);

  // For multi-month averages, exclude the current (partial) month so averages
  // are based only on complete calendar months. '1m' intentionally shows the
  // browsed month in full (even if it's the still-in-progress current month).
  const filteredFull = useMemo(
    () => timeFilter === '1m' ? filtered : filterToFullMonths(filtered, null),
    [filtered, timeFilter],
  );
  const incomeFull   = useMemo(() => filteredFull.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [filteredFull]);
  const expensesFull = useMemo(() => filteredFull.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filteredFull]);
  // Savings rate is total savings / total income over complete calendar months only —
  // computed from aggregate sums (not an average of monthly percentages), since income varies by month.
  const savingsRate = useMemo(() => computeSavingsRate(filteredFull), [filteredFull]);
  const fullMonthCount = useMemo(() => {
    if (timeFilter === '1m') return 1;
    // Custom range: divide by every complete month the user selected, even months
    // with no transactions — that is what "monthly average over this range" means.
    if (timeFilter === 'custom') {
      const cm = currentMonthStr();
      return Math.max(getMonthsInRange(cRangeLo, cRangeHi).filter((m) => m < cm).length, 1);
    }
    const months = new Set(filteredFull.map((t) => t.date.slice(0, 7)));
    return Math.max(months.size, 1);
  }, [timeFilter, filteredFull, cRangeLo, cRangeHi]);

  const isMultiMonth    = monthCount > 1;
  const displayIncome   = isMultiMonth ? incomeFull   / fullMonthCount : income;
  const displayExpenses = isMultiMonth ? expensesFull / fullMonthCount : expenses;
  const displayBalance  = isMultiMonth ? (incomeFull - expensesFull) / fullMonthCount : balance;

  const catExpenses = useMemo(
    () => buildCatRows(filteredFull, 'expense', expensesFull, fullMonthCount, categories),
    [filteredFull, expensesFull, fullMonthCount, categories],
  );

  const housingExpenses = useMemo(
    () => withSectionPct(catExpenses.filter((r) => HOUSING_LABELS.has(r.label))),
    [catExpenses],
  );
  const loanExpenses = useMemo(
    () => withSectionPct(catExpenses.filter((r) => !HOUSING_LABELS.has(r.label) && LOAN_LABELS.has(r.label))),
    [catExpenses],
  );
  const personalExpenses = useMemo(
    () => withSectionPct(catExpenses.filter((r) => !HOUSING_LABELS.has(r.label) && !LOAN_LABELS.has(r.label))),
    [catExpenses],
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

  const buildNavFilters = (catNumericId: number | null, catLabel: string, subNumericId: number | null) => ({
    catNumericId,
    catLabel,
    subNumericId,
    dateFilter: (timeFilter === '1m' ? 'this-month' : 'range') as 'this-month' | 'range',
    selectedMonth: specificMonth,
    rangeStart:
      timeFilter === '1m' ? null
      : timeFilter === 'custom' ? `${cRangeLo}-01`
      : getStartDate(timeFilter),
  });

  const handleExpenseCatNavigate = (catNumericId: number | null, catLabel: string, subNumericId: number | null) => {
    if (!onNavigate) return;
    onNavigate({ ...buildNavFilters(catNumericId, catLabel, subNumericId), txType: 'expense' });
  };

  const handleIncomeCatNavigate = (catNumericId: number | null, catLabel: string, subNumericId: number | null) => {
    if (!onNavigate) return;
    onNavigate({ ...buildNavFilters(catNumericId, catLabel, subNumericId), txType: 'income' });
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

          {/* Custom month-range selector — only for 'טווח מותאם' */}
          {timeFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px 14px', flexWrap: 'wrap', padding: '2px 0 12px' }}>
              <MonthStepper
                label="מ־"
                value={cRangeLo}
                min={earliestMonth <= cRangeLo ? earliestMonth : cRangeLo}
                max={cRangeHi}
                onChange={setCustomStart}
              />
              <MonthStepper
                label="עד"
                value={cRangeHi}
                min={cRangeLo}
                max={today}
                onChange={setCustomEnd}
              />
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

              {(housingExpenses.length > 0 || personalExpenses.length > 0 || loanExpenses.length > 0) && (
                <>
                  {housingExpenses.length > 0 && (
                    <div className="dash-section">
                      <div style={{ marginBottom: '10px', direction: 'rtl' }}>
                        <h3 className="dash-section-title" style={{ margin: 0 }}>הוצאות דיור</h3>
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                          סה"כ {fmt(housingExpenses.reduce((s, r) => s + r.avg, 0))}
                        </span>
                      </div>
                      <CategoryRows
                        rows={housingExpenses}
                        expandedCat={expandedExpCat}
                        onToggle={(l) => setExpandedExpCat((p) => (p === l ? null : l))}
                        subcatAmtColor="#ef4444"
                        onNavigate={onNavigate ? handleExpenseCatNavigate : undefined}
                      />
                    </div>
                  )}
                  {personalExpenses.length > 0 && (
                    <div className="dash-section">
                      <div style={{ marginBottom: '10px', direction: 'rtl' }}>
                        <h3 className="dash-section-title" style={{ margin: 0 }}>הוצאות אישיות לפי קטגוריה</h3>
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                          סה"כ {fmt(personalExpenses.reduce((s, r) => s + r.avg, 0))}
                        </span>
                      </div>
                      <CategoryRows
                        rows={personalExpenses}
                        expandedCat={expandedExpCat}
                        onToggle={(l) => setExpandedExpCat((p) => (p === l ? null : l))}
                        subcatAmtColor="#ef4444"
                        onNavigate={onNavigate ? handleExpenseCatNavigate : undefined}
                      />
                    </div>
                  )}
                  {loanExpenses.length > 0 && (
                    <div className="dash-section">
                      <div style={{ marginBottom: '10px', direction: 'rtl' }}>
                        <h3 className="dash-section-title" style={{ margin: 0 }}>החזרי הלוואות</h3>
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                          סה"כ {fmt(loanExpenses.reduce((s, r) => s + r.avg, 0))}
                        </span>
                      </div>
                      <CategoryRows
                        rows={loanExpenses}
                        expandedCat={expandedExpCat}
                        onToggle={(l) => setExpandedExpCat((p) => (p === l ? null : l))}
                        subcatAmtColor="#ef4444"
                        onNavigate={onNavigate ? handleExpenseCatNavigate : undefined}
                      />
                    </div>
                  )}
                </>
              )}

              {catIncome.length > 0 && (
                <div className="dash-section">
                  <div style={{ marginBottom: '10px', direction: 'rtl' }}>
                    <h3 className="dash-section-title" style={{ margin: 0 }}>הכנסות לפי קטגוריה</h3>
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                      סה"כ {fmt(catIncome.reduce((s, r) => s + r.avg, 0))}
                    </span>
                  </div>
                  <CategoryRows
                    rows={catIncome}
                    expandedCat={expandedIncCat}
                    onToggle={(l) => setExpandedIncCat((p) => (p === l ? null : l))}
                    subcatAmtColor="#16a34a"
                    onNavigate={onNavigate ? handleIncomeCatNavigate : undefined}
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
