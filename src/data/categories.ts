import { Category } from '../types';

export const EXPENSE_CATEGORIES: Category[] = [
  {
    id: 'entertainment',
    label: 'בילויים',
    icon: '🎉',
    isQuick: true,
    subcategories: [],
    type: 'expense',
  },
  {
    id: 'housing',
    label: 'דיור',
    icon: '🏠',
    isQuick: false,
    subcategories: [
      { id: 'arnona',        label: 'ארנונה',              icon: '🏛️' },
      { id: 'home-expenses', label: 'כלל הוצאות הבית',    icon: '🔑' },
    ],
    defaultSubcategoryId: 'arnona',
    type: 'expense',
  },
  {
    id: 'health',
    label: 'בריאות',
    icon: '💊',
    isQuick: false,
    subcategories: [
      { id: 'medicine',    label: 'רפואה',            icon: '💊' },
      { id: 'alternative', label: 'רפואה משלימה',     icon: '🌿' },
      { id: 'dental',      label: 'שיניים',           icon: '🦷' },
    ],
    defaultSubcategoryId: 'medicine',
    type: 'expense',
  },
  {
    id: 'transport',
    label: 'תחבורה',
    icon: '🛴',
    isQuick: false,
    subcategories: [
      { id: 'scooter', label: 'קורקינט',          icon: '🛴' },
      { id: 'parking', label: 'חנייה',             icon: '🅿️' },
      { id: 'public',  label: 'תחבורה ציבורית',    icon: '🚌' },
      { id: 'fuel',    label: 'דלק',               icon: '⛽' },
    ],
    defaultSubcategoryId: 'scooter',
    type: 'expense',
  },
  {
    id: 'vacation',
    label: 'חופשה',
    icon: '✈️',
    isQuick: false,
    subcategories: [
      { id: 'vacation-entertainment', label: 'בילויים', icon: '🎡' },
      { id: 'vacation-misc',          label: 'שונות',   icon: '🧳' },
      { id: 'flight',                 label: 'טיסה',    icon: '✈️' },
      { id: 'hotel',                  label: 'מלון',    icon: '🏨' },
    ],
    defaultSubcategoryId: 'vacation-entertainment',
    type: 'expense',
  },
  {
    id: 'gifts',
    label: 'מתנות',
    icon: '🎁',
    isQuick: false,
    subcategories: [
      { id: 'gifts-misc', label: 'שונות',  icon: '🎁' },
      { id: 'wedding',    label: 'חתונה',  icon: '💍' },
    ],
    defaultSubcategoryId: 'gifts-misc',
    type: 'expense',
  },
  {
    id: 'clothing',
    label: 'ביגוד',
    icon: '👕',
    isQuick: true,
    subcategories: [],
    type: 'expense',
  },
  {
    id: 'learning',
    label: 'למידה והתפתחות',
    icon: '📚',
    isQuick: false,
    subcategories: [
      { id: 'books',   label: 'ספרים',  icon: '📖' },
      { id: 'courses', label: 'קורסים', icon: '🎓' },
    ],
    defaultSubcategoryId: 'books',
    type: 'expense',
  },
  {
    id: 'equipment',
    label: 'ציוד ואביזרים',
    icon: '🔧',
    isQuick: true,
    subcategories: [],
    type: 'expense',
  },
  {
    id: 'subscriptions',
    label: 'מינויים',
    icon: '📱',
    isQuick: false,
    subcategories: [
      { id: 'online', label: 'מינויים אינטרנטיים', icon: '🌐' },
      { id: 'gym',    label: 'חדר כושר',           icon: '🏋️' },
    ],
    defaultSubcategoryId: 'online',
    type: 'expense',
  },
  {
    id: 'fines',
    label: 'קנסות',
    icon: '🚨',
    isQuick: true,
    subcategories: [],
    type: 'expense',
  },
  {
    id: 'loan',
    label: 'החזר הלוואה',
    icon: '💳',
    isQuick: false,
    // principal only — not interest
    subcategories: [],
    type: 'expense',
  },
];

export const INCOME_CATEGORIES: Category[] = [
  {
    id: 'salary',
    label: 'שכר',
    icon: '💰',
    isQuick: true,
    subcategories: [],
    type: 'income',
  },
  {
    id: 'help-refund',
    label: 'עזרה/החזר',
    icon: '🤝',
    isQuick: false,
    subcategories: [
      { id: 'parents', label: 'הורים', icon: '👨‍👩‍👧' },
    ],
    defaultSubcategoryId: 'parents',
    type: 'income',
  },
];

export const getCategoriesForType = (type: 'expense' | 'income') =>
  type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
