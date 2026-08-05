import { describe, it, expect } from 'vitest';
import { currentMonthStr, getStartDate, filterToFullMonths, computeSavingsRate, SimpleTx } from './reportMath';

// "Now" fixed at August 15, 2026 for all tests below (matches the bug report's example).
const NOW = new Date(2026, 7, 15); // month is 0-indexed: 7 = August

function tx(type: 'income' | 'expense', amount: number, date: string): SimpleTx {
  return { type, amount, date };
}

describe('currentMonthStr / getStartDate', () => {
  it('returns the current month as YYYY-MM', () => {
    expect(currentMonthStr(NOW)).toBe('2026-08');
  });

  it('computes the start date for a 3-month range as 3 months before the current month', () => {
    expect(getStartDate(3, NOW)).toBe('2026-05-01');
  });

  it('computes the start date for 6 and 12 month ranges, including year rollover', () => {
    expect(getStartDate(6, NOW)).toBe('2026-02-01');
    expect(getStartDate(12, NOW)).toBe('2025-08-01');
  });

  it('returns null for an "all time" range', () => {
    expect(getStartDate(null, NOW)).toBeNull();
  });
});

describe('filterToFullMonths', () => {
  it('excludes the current, still-in-progress month', () => {
    const txs = [
      tx('income', 100, '2026-07-15'),
      tx('income', 100, '2026-08-01'), // current month — must be excluded
    ];
    const result = filterToFullMonths(txs, null, NOW);
    expect(result.map((t) => t.date)).toEqual(['2026-07-15']);
  });

  it('excludes transactions before the given start date', () => {
    const txs = [
      tx('income', 100, '2026-04-30'), // before May 1 start — excluded
      tx('income', 100, '2026-05-01'),
    ];
    const result = filterToFullMonths(txs, '2026-05-01', NOW);
    expect(result.map((t) => t.date)).toEqual(['2026-05-01']);
  });
});

describe('computeSavingsRate — 3 full months (May, June, July)', () => {
  const txs = [
    tx('income', 10000, '2026-05-01'), tx('expense', 6760, '2026-05-15'), // 32.4%
    tx('income', 10000, '2026-06-01'), tx('expense', 6860, '2026-06-15'), // 31.4%
    tx('income', 10000, '2026-07-01'), tx('expense', 7350, '2026-07-15'), // 26.5%
    tx('income', 10000, '2026-08-01'), tx('expense', 9000, '2026-08-15'), // current month — must NOT count
  ];

  it('includes only May–July and ignores the partial August data', () => {
    const start = getStartDate(3, NOW);
    const scoped = filterToFullMonths(txs, start, NOW);
    expect(scoped.every((t) => t.date < '2026-08')).toBe(true);
    expect(scoped.length).toBe(6);
  });

  it('is the aggregate ratio of total savings to total income, not an average of monthly rates', () => {
    const start = getStartDate(3, NOW);
    const scoped = filterToFullMonths(txs, start, NOW);
    const rate = computeSavingsRate(scoped);
    // (30000 - 20970) / 30000 * 100
    expect(rate).toBeCloseTo(30.1, 1);
  });
});

describe('computeSavingsRate — 6 and 12 full months', () => {
  const monthlyTxs: SimpleTx[] = [];
  // 13 months of data: 2025-08 .. 2026-08 (August 2026 is the current, partial month)
  for (let i = 0; i < 13; i++) {
    const total = 2025 * 12 + 7 + i; // Aug 2025 = year*12+7 (0-indexed)
    const y = Math.floor(total / 12);
    const m = String((total % 12) + 1).padStart(2, '0');
    monthlyTxs.push(tx('income', 10000, `${y}-${m}-01`));
    monthlyTxs.push(tx('expense', 7000, `${y}-${m}-15`));
  }

  it('6-month range covers exactly 6 full months and excludes the current month', () => {
    const start = getStartDate(6, NOW);
    const scoped = filterToFullMonths(monthlyTxs, start, NOW);
    const months = new Set(scoped.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBe(6);
    expect(months.has('2026-08')).toBe(false);
  });

  it('12-month range covers exactly 12 full months and excludes the current month', () => {
    const start = getStartDate(12, NOW);
    const scoped = filterToFullMonths(monthlyTxs, start, NOW);
    const months = new Set(scoped.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBe(12);
    expect(months.has('2026-08')).toBe(false);
  });

  it('gives the same 30% rate regardless of range length, since every full month is identical', () => {
    for (const monthsBack of [6, 12]) {
      const start = getStartDate(monthsBack, NOW);
      const scoped = filterToFullMonths(monthlyTxs, start, NOW);
      expect(computeSavingsRate(scoped)).toBeCloseTo(30, 5);
    }
  });
});

describe('computeSavingsRate — no income (division-by-zero guard)', () => {
  it('returns null instead of 0 or NaN when there is no income in range', () => {
    const txs = [tx('expense', 500, '2026-07-10')];
    expect(computeSavingsRate(txs)).toBeNull();
  });

  it('returns null for an empty transaction list', () => {
    expect(computeSavingsRate([])).toBeNull();
  });
});
