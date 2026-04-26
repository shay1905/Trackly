import { useEffect, useState } from 'react';
import { RecurringRule, Transaction } from '../types';
import { supabase } from '../lib/supabase';

function mapRowToRule(row: any): RecurringRule {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    categoryLabel: row.category_label,
    subcategoryLabel: row.subcategory_label ?? '',
    description: row.description ?? '',
    startDate: row.start_date,
    dayOfMonth: row.day_of_month,
    isActive: row.is_active,
    createdDate: row.created_date,
    categoryNumericId: row.category_id ?? null,
    subcategoryNumericId: row.subcategory_id ?? null,
  };
}

export function buildRecurringTransactionsForRule(
  rule: RecurringRule,
  existingMonthKeys: Set<string>,
): Transaction[] {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startYM = rule.startDate.slice(0, 7);
  const result: Transaction[] = [];

  let ym = startYM;
  while (ym <= currentYM) {
    if (!existingMonthKeys.has(ym)) {
      const [y, m] = ym.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const day = Math.min(rule.dayOfMonth, daysInMonth);
      const date = `${ym}-${String(day).padStart(2, '0')}`;
      result.push({
        id: crypto.randomUUID(),
        type: rule.type,
        amount: rule.amount,
        categoryLabel: rule.categoryLabel,
        subcategoryLabel: rule.subcategoryLabel,
        description: rule.description,
        date,
        installments: 1,
        recurrence: 'monthly',
        recurrenceGroupId: rule.id,
        categoryNumericId: rule.categoryNumericId,
        subcategoryNumericId: rule.subcategoryNumericId,
      });
    }
    const [y, m] = ym.split('-').map(Number);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    ym = `${nextY}-${String(nextM).padStart(2, '0')}`;
  }

  return result;
}

export function useRecurringRules() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadRecurringRules();
  }, []);

  async function loadRecurringRules() {
    const { data, error } = await supabase
      .from('recurring_rules')
      .select('*')
      .eq('is_active', true)
      .order('created_date', { ascending: false });
    if (error) { console.error('Failed loading recurring rules:', error); return; }
    setRules((data ?? []).map(mapRowToRule));
    setLoaded(true);
  }

  async function addRecurringRule(
    rule: Omit<RecurringRule, 'id' | 'createdDate' | 'isActive'>,
  ): Promise<RecurringRule | null> {
    const today = new Date().toISOString().split('T')[0];
    const row = {
      id: crypto.randomUUID(),
      type: rule.type,
      amount: rule.amount,
      category_label: rule.categoryLabel ?? '',
      subcategory_label: rule.subcategoryLabel ?? null,
      description: rule.description ?? '',
      start_date: rule.startDate,
      day_of_month: rule.dayOfMonth,
      is_active: true,
      created_date: today,
      category_id: rule.categoryNumericId ?? null,
      subcategory_id: rule.subcategoryNumericId ?? null,
    };
    const { data, error } = await supabase
      .from('recurring_rules')
      .insert([row])
      .select()
      .single();
    if (error) { console.error('Failed adding recurring rule:', error); return null; }
    if (data) {
      const newRule = mapRowToRule(data);
      setRules((prev) => [newRule, ...prev]);
      return newRule;
    }
    return null;
  }

  async function updateRecurringRule(rule: RecurringRule) {
    const { error } = await supabase
      .from('recurring_rules')
      .update({
        amount: rule.amount,
        category_label: rule.categoryLabel ?? '',
        subcategory_label: rule.subcategoryLabel ?? null,
        description: rule.description ?? '',
        start_date: rule.startDate,
        day_of_month: rule.dayOfMonth,
        category_id: rule.categoryNumericId ?? null,
        subcategory_id: rule.subcategoryNumericId ?? null,
      })
      .eq('id', rule.id);
    if (error) { console.error('Failed updating recurring rule:', error); return; }
    setRules((prev) => prev.map((r) => r.id === rule.id ? rule : r));
  }

  async function deactivateRecurringRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase
      .from('recurring_rules')
      .update({ is_active: false })
      .eq('id', id);
    if (error) { console.error('Failed deactivating recurring rule:', error); void loadRecurringRules(); }
  }

  return { rules, loaded, addRecurringRule, updateRecurringRule, deactivateRecurringRule };
}
