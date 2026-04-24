import { useEffect, useState } from 'react';
import { Transaction } from '../types';
import { supabase } from '../lib/supabase';

function mapRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    categoryId: row.category_id,
    categoryLabel: row.category_label,
    categoryIcon: row.category_icon,
    subcategoryId: row.subcategory_id ?? '',
    subcategoryLabel: row.subcategory_label ?? '',
    description: row.description ?? '',
    date: row.date,
    installments: row.installments,
    recurrence: row.recurrence,
    createdAt: row.created_at,
    installmentGroupId: row.installment_group_id ?? undefined,
    installmentIndex: row.installment_index ?? undefined,
    installmentTotal: row.installment_total ?? undefined,
    recurrenceGroupId: row.recurrence_group_id ?? undefined,
    recurrenceIndex: row.recurrence_index ?? undefined,
    recurrenceTotal: row.recurrence_total ?? undefined,
    categoryNumericId: row.category_numeric_id ?? undefined,
    subcategoryNumericId: row.subcategory_numeric_id ?? undefined,
  };
}

function mapTransactionToRow(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    category_id: t.categoryId,
    category_label: t.categoryLabel,
    category_icon: t.categoryIcon,
    subcategory_id: t.subcategoryId || null,
    subcategory_label: t.subcategoryLabel || null,
    description: t.description,
    date: t.date,
    installments: t.installments,
    recurrence: t.recurrence,
    created_at: t.createdAt,
    installment_group_id: t.installmentGroupId ?? null,
    installment_index: t.installmentIndex ?? null,
    installment_total: t.installmentTotal ?? null,
    recurrence_group_id: t.recurrenceGroupId ?? null,
    recurrence_index: t.recurrenceIndex ?? null,
    recurrence_total: t.recurrenceTotal ?? null,
    category_numeric_id: t.categoryNumericId ?? null,
    subcategory_numeric_id: t.subcategoryNumericId ?? null,
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
      .order('created_at', { ascending: false });

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

  async function removeGroup(groupId: string) {
    const ids = transactions
      .filter(
        (t) =>
          t.installmentGroupId === groupId ||
          t.recurrenceGroupId === groupId
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

    setTransactions((prev) =>
      prev.filter(
        (t) =>
          t.installmentGroupId !== groupId &&
          t.recurrenceGroupId !== groupId
      )
    );
  }

  return {
    transactions,
    addTransactions,
    removeTransaction,
    removeGroup,
  };
}
