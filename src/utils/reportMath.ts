// Pure date-range and savings-rate math shared by the Reports screen.
// Kept dependency-free so it can be unit tested without rendering React.

export type SimpleTx = { type: 'income' | 'expense'; amount: number; date: string };

export function currentMonthStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Start date (YYYY-MM-DD, inclusive) for a rolling N-month range ending at "now".
// null monthsBack means "all time" (no lower bound).
export function getStartDate(monthsBack: number | null, now: Date = new Date()): string | null {
  if (monthsBack === null) return null;
  // Integer arithmetic avoids toISOString() UTC-shift (e.g. Israel UTC+3 would turn Feb 1 → Jan 31)
  const totalMonths = now.getFullYear() * 12 + now.getMonth() - monthsBack;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12; // 0-indexed
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

// Keeps only transactions in complete calendar months: on/after startDate (if given)
// and strictly before the current, still-in-progress month.
export function filterToFullMonths<T extends { date: string }>(
  transactions: T[],
  startDate: string | null,
  now: Date = new Date(),
): T[] {
  const cm = currentMonthStr(now);
  return transactions.filter((t) => {
    if (startDate !== null && t.date < startDate) return false;
    return t.date.slice(0, 7) < cm;
  });
}

// Savings rate = total savings / total income across the given transactions, as a percentage.
// This is an aggregate ratio, NOT an average of per-month rates, since income varies by month.
// Returns null when there is no income (avoids divide-by-zero / a misleading 0%).
export function computeSavingsRate(transactions: SimpleTx[]): number | null {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return income > 0 ? ((income - expenses) / income) * 100 : null;
}
