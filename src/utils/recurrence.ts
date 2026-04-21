import { RecurrenceType } from '../types';

export function addPeriod(dateStr: string, type: RecurrenceType, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  switch (type) {
    case 'monthly': d.setMonth(d.getMonth() + n); break;
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

  const dates: string[] = [startDate];

  if (endMode === 'occurrences') {
    const count = Math.max(1, occurrences);
    for (let i = 1; i < count; i++) {
      dates.push(addPeriod(startDate, type, i));
    }
  } else {
    if (!endDate || endDate <= startDate) return dates;
    const limit = new Date(endDate + 'T00:00:00');
    let i = 1;
    while (i < 500) {
      const next = addPeriod(startDate, type, i);
      if (new Date(next + 'T00:00:00') > limit) break;
      dates.push(next);
      i++;
    }
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
