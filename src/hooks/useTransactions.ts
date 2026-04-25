import { useEffect, useState } from 'react';
import { Transaction } from '../types';
import { supabase } from '../lib/supabase';

function mapRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    categoryLabel: row.category_label,
    subcategoryLabel: row.subcategory_label ?? '',
    description: row.description ?? '',
    date: row.date,
    installments: row.installments,
    recurrence: row.recurrence,
    installmentGroupId: row.installment_group_id ?? undefined,
    installmentIndex: row.installment_index ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    recurrenceGroupId: row.recurrence_group_id ?? undefined,
    recurrenceIndex: row.recurrence_index ?? undefined,
    recurrenceTotal: row.recurrence_total ?? undefined,
    categoryNumericId: row.category_id ?? null,
    subcategoryNumericId: row.subcategory_id ?? null,
  };
}

function mapTransactionToRow(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    category_id: t.categoryNumericId ?? null,
    category_label: t.categoryLabel,
    subcategory_id: t.subcategoryNumericId ?? null,
    subcategory_label: t.subcategoryLabel || null,
    description: t.description,
    date: t.date,
    installments: t.installments,
    recurrence: t.recurrence,
    installment_group_id: t.installmentGroupId ?? null,
    installment_index: t.installmentIndex ?? null,
    installment_total: t.installmentTotal ?? null,
    recurrence_group_id: t.recurrenceGroupId ?? null,
    recurrence_index: t.recurrenceIndex ?? null,
    recurrence_total: t.recurrenceTotal ?? null,
    is_deleted: false,
    created_date: new Date().toISOString().split('T')[0],
  };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    void loadTransactions();
  }, []);

  async function loadTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_date', { ascending: false });

    if (error) {
      console.error('Failed loading transactions:', error);
      return;
    }

    setTransactions((data ?? []).map(mapRowToTransaction));
  }

  async function addTransactions(items: Transaction[]) {
    const rows = items.map(mapTransactionToRow);

    const { error } = await supabase
      .from('transactions')
      .insert(rows);

    if (error) {
      console.error('Failed inserting transactions:', error);
      return;
    }

    setTransactions((prev) => [...items, ...prev]);
  }

  async function removeTransaction(id: string) {
    const { error } = await supabase
      .from('transactions')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Failed deleting transaction:', error);
      return;
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function updateTransaction(t: Transaction) {
    const { error } = await supabase
      .from('transactions')
      .update({
        amount: t.amount,
        category_id: t.categoryNumericId ?? null,
        category_label: t.categoryLabel,
        subcategory_id: t.subcategoryNumericId ?? null,
        subcategory_label: t.subcategoryLabel || null,
        description: t.description,
        date: t.date,
      })
      .eq('id', t.id);

    if (error) {
      console.error('Failed updating transaction:', error);
      return;
    }

    setTransactions((prev) => prev.map((x) => x.id === t.id ? t : x));
  }

  async function updateTransactionGroup(
    groupId: string,
    current: Transaction,
    groupSafe: {
      categoryNumericId: number | null;
      categoryLabel: string;
      subcategoryNumericId: number | null;
      subcategoryLabel: string;
      description: string;
    },
  ) {
    const { error: err1 } = await supabase
      .from('transactions')
      .update({
        amount:           current.amount,
        category_id:      current.categoryNumericId ?? null,
        category_label:   current.categoryLabel,
        subcategory_id:   current.subcategoryNumericId ?? null,
        subcategory_label: current.subcategoryLabel || null,
        description:      current.description,
        date:             current.date,
      })
      .eq('id', current.id);

    if (err1) { console.error('Failed updating current tx:', err1); return; }

    const otherIds = transactions
      .filter((t) =>
        (t.installmentGroupId === groupId || t.recurrenceGroupId === groupId) &&
        t.id !== current.id,
      )
      .map((t) => t.id);

    if (otherIds.length > 0) {
      const { error: err2 } = await supabase
        .from('transactions')
        .update({
          category_id:       groupSafe.categoryNumericId ?? null,
          category_label:    groupSafe.categoryLabel,
          subcategory_id:    groupSafe.subcategoryNumericId ?? null,
          subcategory_label: groupSafe.subcategoryLabel || null,
          description:       groupSafe.description,
        })
        .in('id', otherIds);

      if (err2) { console.error('Failed updating group txs:', err2); return; }
    }

    setTransactions((prev) => prev.map((t) => {
      if (t.id === current.id) return current;
      if (otherIds.includes(t.id)) return {
        ...t,
        categoryNumericId:    groupSafe.categoryNumericId,
        categoryLabel:        groupSafe.categoryLabel,
        subcategoryNumericId: groupSafe.subcategoryNumericId ?? null,
        subcategoryLabel:     groupSafe.subcategoryLabel,
        description:          groupSafe.description,
      };
      return t;
    }));
  }

  async function removeGroup(groupId: string, from: Transaction) {
    const ids = transactions
      .filter(
        (t) =>
          (t.installmentGroupId === groupId || t.recurrenceGroupId === groupId) &&
          t.date >= from.date
      )
      .map((t) => t.id);

    if (!ids.length) return;

    const { error } = await supabase
      .from('transactions')
      .update({ is_deleted: true })
      .in('id', ids);

    if (error) {
      console.error('Failed deleting transaction group:', error);
      return;
    }

    setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
  }

  return {
    transactions,
    addTransactions,
    removeTransaction,
    removeGroup,
    updateTransaction,
    updateTransactionGroup,
  };
}
