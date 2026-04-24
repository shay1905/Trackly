export type TransactionType = 'expense' | 'income';

export type RecurrenceType = 'one-time' | 'monthly' | 'weekly' | 'yearly';

export interface Subcategory {
  id: string;
  numericId?: number;
  label: string;
  icon: string;
}

export interface Category {
  id: string;
  numericId?: number;
  label: string;
  icon: string;
  isQuick: boolean;
  subcategories: Subcategory[];
  defaultSubcategoryId?: string;
  type: TransactionType | 'both';
}

export type RecurrenceEndMode = 'occurrences' | 'end-date';

export interface TransactionForm {
  type: TransactionType;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  description: string;
  date: string;
  installments: number;
  recurrence: RecurrenceType;
  recurrenceEndMode: RecurrenceEndMode;
  recurrenceOccurrences: number;
  recurrenceEndDate: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId?: string;
  categoryLabel: string;
  subcategoryId?: string;
  subcategoryLabel: string;
  description: string;
  date: string;
  installments: number;
  recurrence: RecurrenceType;
  // installment series metadata
  installmentGroupId?: string;
  installmentIndex?: number;
  installmentTotal?: number;
  // recurrence series metadata
  recurrenceGroupId?: string;
  recurrenceIndex?: number;
  recurrenceTotal?: number;
  // numeric FK references
  categoryNumericId: number | null;
  subcategoryNumericId: number | null;
}
