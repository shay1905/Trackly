import { useState, useMemo } from 'react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
}

type TimeFilter = '1m' | '3m' | '6m' | '12m' | 'all';

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: '1m',  label: 'החודש' },
  { key: '3m',  label: '3 חודשים' },
  { key: '6m',  label: '6 חודשים' },
  { key: '12m', label: '12 חודשים' },
  { key: 'all', label: 'הכל' },
];

function getStartDate(filter: TimeFilter): string | null {
  if (filter === 'all') return null;
  const now = new Date();
  const monthsBack = filter === '1m' ? 0 : filter === '3m' ? 2 : filter === '6m' ? 5 : 11;
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return d.toISOString().split('T')[0];
}

function fmt(n: number): string {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 0 }) + ' ₪';
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return `${mo}/${y}`;
}

export default function Dashboard({ transactions }: Props) {
  const [timeFilter, setTimeFilter]       = useState<TimeFilter>('1m');
  const [selectedCatLabel, setSelectedCatLabel] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const start = getStartDate(timeFilter);
    if (!start) return transactions;
    return transactions.filter((t) => t.date >= start);
  }, [transactions, timeFilter]);

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

  const avgIncome   = income   / monthCount;
  const avgExpenses = expenses / monthCount;
  const avgBalance  = balance  / monthCount;

  const catExpenses = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter((t) => t.type === 'expense').forEach((t) => {
      map.set(t.categoryLabel, (map.get(t.categoryLabel) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount, pct: expenses > 0 ? (amount / expenses) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, expenses]);

  const expenseCatLabels = useMemo(
    () => [...new Set(filtered.filter((t) => t.type === 'expense' && t.subcategoryLabel).map((t) => t.categoryLabel))],
    [filtered],
  );

  const subcatBreakdown = useMemo(() => {
    if (!selectedCatLabel) return [];
    const map = new Map<string, number>();
    filtered
      .filter((t) => t.type === 'expense' && t.categoryLabel === selectedCatLabel && t.subcategoryLabel)
      .forEach((t) => {
        map.set(t.subcategoryLabel, (map.get(t.subcategoryLabel) ?? 0) + t.amount);
      });
    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, selectedCatLabel]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    filtered.forEach((t) => {
      const month = t.date.slice(0, 7);
      if (!map.has(month)) map.set(month, { income: 0, expenses: 0 });
      const entry = map.get(month)!;
      if (t.type === 'income') entry.income += t.amount;
      else entry.expenses += t.amount;
    });
    return Array.from(map.entries())
      .map(([month, { income: inc, expenses: exp }]) => ({ month, income: inc, expenses: exp, balance: inc - exp }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const maxMonthVal = useMemo(
    () => Math.max(...monthlyTrend.flatMap((m) => [m.income, m.expenses]), 1),
    [monthlyTrend],
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">דשבורד</h2>
      </div>

      <div className="dash-filter-row">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`dash-filter-btn${timeFilter === f.key ? ' active' : ''}`}
            onClick={() => { setTimeFilter(f.key); setSelectedCatLabel(null); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="dash-empty">
          <span className="dash-empty-icon">📊</span>
          <p>אין נתונים לתקופה זו</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="dash-cards">
            <div className="dash-card">
              <span className="dash-card-label">סה״כ הכנסות</span>
              <span className="dash-card-value income">{fmt(income)}</span>
            </div>
            <div className="dash-card">
              <span className="dash-card-label">סה״כ הוצאות</span>
              <span className="dash-card-value expense">{fmt(expenses)}</span>
            </div>
            <div className="dash-card">
              <span className="dash-card-label">יתרה</span>
              <span className={`dash-card-value${balance >= 0 ? ' income' : ' expense'}`}>{fmt(balance)}</span>
            </div>
            <div className="dash-card">
              <span className="dash-card-label">שיעור חיסכון</span>
              <span className="dash-card-value">{savingsRate !== null ? fmtPct(savingsRate) : '—'}</span>
            </div>
          </div>

          {/* Monthly averages */}
          <div className="dash-section">
            <h3 className="dash-section-title">ממוצע חודשי</h3>
            <div className="dash-avg-list">
              <div className="dash-avg-row">
                <span className="dash-avg-label">הכנסה חודשית ממוצעת</span>
                <span className="dash-avg-value income">{fmt(avgIncome)}</span>
              </div>
              <div className="dash-avg-row">
                <span className="dash-avg-label">הוצאה חודשית ממוצעת</span>
                <span className="dash-avg-value expense">{fmt(avgExpenses)}</span>
              </div>
              <div className="dash-avg-row">
                <span className="dash-avg-label">יתרה חודשית ממוצעת</span>
                <span className={`dash-avg-value${avgBalance >= 0 ? ' income' : ' expense'}`}>{fmt(avgBalance)}</span>
              </div>
              <div className="dash-avg-row">
                <span className="dash-avg-label">שיעור חיסכון ממוצע</span>
                <span className="dash-avg-value">{savingsRate !== null ? fmtPct(savingsRate) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Expenses by category */}
          {catExpenses.length > 0 && (
            <div className="dash-section">
              <h3 className="dash-section-title">הוצאות לפי קטגוריה</h3>
              <div className="dash-cat-list">
                {catExpenses.map(({ label, amount, pct }) => (
                  <div key={label} className="dash-cat-row">
                    <div className="dash-cat-info">
                      <span className="dash-cat-label">{label}</span>
                      <span className="dash-cat-pct">{fmtPct(pct)}</span>
                    </div>
                    <div className="dash-cat-bar-wrap">
                      <div className="dash-cat-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="dash-cat-amount">{fmt(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subcategory breakdown */}
          {expenseCatLabels.length > 0 && (
            <div className="dash-section">
              <h3 className="dash-section-title">פירוט תת-קטגוריה</h3>
              <div className="dash-filter-row dash-subcat-filter">
                {expenseCatLabels.map((label) => (
                  <button
                    key={label}
                    className={`dash-filter-btn${selectedCatLabel === label ? ' active' : ''}`}
                    onClick={() => setSelectedCatLabel((prev) => (prev === label ? null : label))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {selectedCatLabel && subcatBreakdown.length > 0 && (
                <div className="dash-avg-list">
                  {subcatBreakdown.map(({ label, amount }) => (
                    <div key={label} className="dash-avg-row">
                      <span className="dash-avg-label">{label}</span>
                      <span className="dash-avg-value expense">{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedCatLabel && subcatBreakdown.length === 0 && (
                <p className="dash-empty-note">אין נתוני תת-קטגוריה</p>
              )}
            </div>
          )}

          {/* Monthly trend */}
          {monthlyTrend.length > 0 && (
            <div className="dash-section">
              <h3 className="dash-section-title">מגמה חודשית</h3>
              <div className="dash-trend-list">
                {monthlyTrend.map(({ month, income: inc, expenses: exp, balance: bal }) => (
                  <div key={month} className="dash-trend-row">
                    <span className="dash-trend-month">{fmtMonth(month)}</span>
                    <div className="dash-trend-bars">
                      <div className="dash-trend-bar-row">
                        <span className="dash-trend-bar-label">הכנסה</span>
                        <div className="dash-trend-bar-wrap">
                          <div className="dash-trend-bar income" style={{ width: `${(inc / maxMonthVal) * 100}%` }} />
                        </div>
                        <span className="dash-trend-bar-amt income">{fmt(inc)}</span>
                      </div>
                      <div className="dash-trend-bar-row">
                        <span className="dash-trend-bar-label">הוצאה</span>
                        <div className="dash-trend-bar-wrap">
                          <div className="dash-trend-bar expense" style={{ width: `${(exp / maxMonthVal) * 100}%` }} />
                        </div>
                        <span className="dash-trend-bar-amt expense">{fmt(exp)}</span>
                      </div>
                    </div>
                    <div className="dash-trend-balance-row">
                      <span className="dash-trend-balance-label">יתרה</span>
                      <span className={`dash-trend-balance${bal >= 0 ? ' income' : ' expense'}`}>{fmt(bal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
