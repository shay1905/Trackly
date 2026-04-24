import { RecurrenceType } from '../types';

export function addPeriod(dateStr: string, type: RecurrenceType, n: number): string {
  if (type === 'monthly') {
    const [y, m, day] = dateStr.split('-').map(Number);
    const totalMonths = (m - 1) + n;
    const targetYear = y + Math.floor(totalMonths / 12);
    const targetMonth = totalMonths % 12; // 0-indexed
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const finalDay = Math.min(day, daysInMonth);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
  }
  const d = new Date(dateStr + 'T00:00:00');
  switch (type) {
    case 'weekly':  d.setDate(d.getDate() + n * 7); break;
    case 'yearly':  d.setFullYear(d.getFullYear() + n); break;
    default: break;
  }
  return d.toISOString().split('T')[0];
}

export function generateRecurringDates(
  startDate: string,
  type: RecurrenceType,
  endMode: 'occurrences' | 'end-date',
  occurrences: number,
  endDate: string,
): string[] {
  if (type === 'one-time') return [startDate];

  if (endMode === 'occurrences') {
    const count = Math.max(1, occurrences);
    const dates: string[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(addPeriod(startDate, type, i));
    }
    return dates;
  }

  // end-date mode
  const firstDate = type === 'monthly' ? addPeriod(startDate, type, 0) : startDate;
  const dates: string[] = [firstDate];
  if (!endDate || endDate <= startDate) return dates;
  const limit = new Date(endDate + 'T00:00:00');
  let i = 1;
  while (i < 500) {
    const next = addPeriod(startDate, type, i);
    if (new Date(next + 'T00:00:00') > limit) break;
    dates.push(next);
    i++;
  }
  return dates;
}

/** Count how many occurrences fit from start to end for a given recurrence type */
export function countOccurrences(
  startDate: string,
  type: RecurrenceType,
  endDate: string,
): number {
  if (!endDate || endDate < startDate || type === 'one-time') return 0;
  const limit = new Date(endDate + 'T00:00:00');
  let count = 1;
  let i = 1;
  while (i < 500) {
    const next = addPeriod(startDate, type, i);
    if (new Date(next + 'T00:00:00') > limit) break;
    count++;
    i++;
  }
  return count;
}
