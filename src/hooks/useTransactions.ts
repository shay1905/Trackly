import { useState, useEffect } from 'react';
import { Transaction } from '../types';

const STORAGE_KEY = 'trackly_transactions';

function load(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  } catch {
    return [];
  }
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const addTransactions = (items: Transaction[]) =>
    setTransactions((prev) => [...items, ...prev]);

  const removeTransaction = (id: string) =>
    setTransactions((prev) => prev.filter((t) => t.id !== id));

  // Removes all transactions belonging to either an installment or recurrence group
  const removeGroup = (groupId: string) =>
    setTransactions((prev) =>
      prev.filter(
        (t) => t.installmentGroupId !== groupId && t.recurrenceGroupId !== groupId,
      ),
    );

  return { transactions, addTransactions, removeTransaction, removeGroup };
}
