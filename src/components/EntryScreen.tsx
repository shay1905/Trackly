import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TransactionForm, TransactionType, TransactionMode, Transaction, Category,
} from '../types';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useRecurringRules, buildRecurringTransactionsForRule } from '../hooks/useRecurringRules';
import CategoryGrid from './CategoryGrid';
import SubcategoryRow from './SubcategoryRow';
import AmountInput from './AmountInput';
import AdvancedSection from './AdvancedSection';
import TransactionList from './TransactionList';
import Dashboard from './Dashboard';
import NewCategoryModal from './NewCategoryModal';
import ConfirmDialog from './ConfirmDialog';
import EditItemModal from './EditItemModal';
import ItemActionMenu from './ItemActionMenu';

const today = () => new Date().toISOString().split('T')[0];

const defaultForm = (): TransactionForm => ({
  type: 'expense',
  amount: '',
  categoryId: '',
  subcategoryId: '',
  description: '',
  date: today(),
  installments: 2,
  recurrence: 'one-time',
  recurrenceEndMode: 'occurrences',
  recurrenceOccurrences: 2,
  recurrenceEndDate: '',
  transactionMode: 'one-time',
  dayOfMonth: new Date().getDate(),
});

function addMonths(dateStr: string, n: number): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const totalMonths = (m - 1) + n;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12; // 0-indexed
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const finalDay = Math.min(day, daysInMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
}

function splitInstallments(total: number, count: number): number[] {
  const base      = Math.floor((total * 100) / count) / 100;
  const amounts   = Array<number>(count).fill(base);
  const remainder = Math.round((total - base * count) * 100) / 100;
  amounts[count - 1] = Math.round((amounts[count - 1] + remainder) * 100) / 100;
  return amounts;
}

type View = 'entry' | 'history' | 'dashboard';

interface DeleteTarget { kind: 'category' | 'subcategory'; id: string; }
interface EditTarget   { kind: 'category' | 'subcategory'; id: string; icon: string; label: string; }
interface MenuTarget   {
  kind: 'category' | 'subcategory';
  id: string; icon: string; label: string;
  isFirst: boolean;
  isQuick?: boolean;
}

const NAV_CARDS = [
  {
    view: 'dashboard' as View,
    label: 'דוחות',
    tagline: 'סיכום וניתוח',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="12" width="4" height="9" rx="1"/>
        <rect x="10" y="7" width="4" height="14" rx="1"/>
        <rect x="17" y="3" width="4" height="18" rx="1"/>
      </svg>
    ),
  },
  {
    view: 'entry' as View,
    label: 'תיעוד',
    tagline: 'תעד עסקה חדשה',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5"/>
        <path d="M17.5 2.5a2.12 2.12 0 0 1 3 3L12 14l-4 1 1-4 7.5-7.5z"/>
      </svg>
    ),
  },
  {
    view: 'history' as View,
    label: 'תנועות',
    tagline: 'כל העסקאות',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="0.5" fill="currentColor"/>
        <circle cx="3" cy="12" r="0.5" fill="currentColor"/>
        <circle cx="3" cy="18" r="0.5" fill="currentColor"/>
      </svg>
    ),
  },
];

export default function EntryScreen() {
  const [view,            setView]            = useState<View>('entry');
  const [form,            setForm]            = useState<TransactionForm>(defaultForm());
  const [advancedOpen,    setAdvancedOpen]    = useState(false);
  const [errors,          setErrors]          = useState<Partial<Record<keyof TransactionForm, string>>>({});
  const [saved,           setSaved]           = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editMode,        setEditMode]        = useState(false);
  const [quickOpen,       setQuickOpen]       = useState(true);
  const [additionalOpen,  setAdditionalOpen]  = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<DeleteTarget | null>(null);
  const [editTarget,      setEditTarget]      = useState<EditTarget   | null>(null);
  const [menuTarget,      setMenuTarget]      = useState<MenuTarget   | null>(null);

  const categoryAreaRef = useRef<HTMLDivElement>(null);
  const carouselRef     = useRef<HTMLDivElement>(null);

  // Exit edit mode when tapping outside the category area
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: PointerEvent) => {
      if (categoryAreaRef.current && !categoryAreaRef.current.contains(e.target as Node)) {
        setEditMode(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [editMode]);

  // Scroll carousel to תיעוד (index 1) on mount
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.children[1] as HTMLElement;
    el.scrollLeft = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
  }, []);

  // Sync view state when carousel scroll settles
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0, bestDist = Infinity;
        Array.from(el.children).forEach((child, i) => {
          const c = child as HTMLElement;
          const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (dist < bestDist) { bestDist = dist; best = i; }
        });
        setView(NAV_CARDS[best].view);
      }, 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, []);

  const { transactions, loaded: txLoaded, deletedRecurringMonthKeys, addTransactions, removeTransaction, removeGroup, updateTransaction, updateTransactionGroup, updateInstallmentDates } = useTransactions();
  const { rules: recurringRules, loaded: rulesLoaded, addRecurringRule, updateRecurringRule, deactivateRecurringRule } = useRecurringRules();

  const syncedRef = useRef(false);
  useEffect(() => {
    if (!txLoaded || !rulesLoaded) return;
    if (syncedRef.current) return;
    syncedRef.current = true;
    if (recurringRules.length === 0) return;
    const existingByRule = new Map<string, Set<string>>();
    for (const t of transactions) {
      if (t.recurrenceGroupId && t.recurrence === 'monthly' && !t.recurrenceTotal) {
        const ym = t.date.slice(0, 7);
        if (!existingByRule.has(t.recurrenceGroupId)) existingByRule.set(t.recurrenceGroupId, new Set());
        existingByRule.get(t.recurrenceGroupId)!.add(ym);
      }
    }
    // Treat soft-deleted months as existing so they are never regenerated
    for (const key of deletedRecurringMonthKeys) {
      const sep = key.indexOf('|');
      const ruleId = key.slice(0, sep);
      const ym = key.slice(sep + 1);
      if (!existingByRule.has(ruleId)) existingByRule.set(ruleId, new Set());
      existingByRule.get(ruleId)!.add(ym);
    }
    const missing: Transaction[] = [];
    for (const rule of recurringRules) {
      const existing = existingByRule.get(rule.id) ?? new Set<string>();
      missing.push(...buildRecurringTransactionsForRule(rule, existing));
    }
    if (missing.length > 0) void addTransactions(missing);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txLoaded, rulesLoaded, recurringRules, transactions, deletedRecurringMonthKeys]);
  const {
    categories: allCategories,
    loading: categoriesLoading,
    addCategory, archiveCategory,
    addSubcategory, archiveSubcategory,
    editCategory, editSubcategory,
    setDefaultSubcategory,
    moveCategorySection,
    reorderCategories, reorderSubcategories,
    getCategoriesForType,
  } = useCategories();

  const categories = getCategoriesForType(form.type);

  const quickCats      = form.type === 'expense' ? categories.filter((c) => c.isQuick)  : categories;
  const additionalCats = form.type === 'expense' ? categories.filter((c) => !c.isQuick) : [];

  const selectedCategory = categories.find((c) => c.id === form.categoryId) ?? null;

  // Auto-open additional section when an additional category is explicitly chosen
  const isSelectedCatAdditional = form.type === 'expense' && selectedCategory?.isQuick === false;
  useEffect(() => {
    if (isSelectedCatAdditional) setAdditionalOpen(true);
  }, [isSelectedCatAdditional]);

  // Ensure default sub is selected when category changes or its default changes
  useEffect(() => {
    if (!selectedCategory) return;
    const defaultSub = selectedCategory.defaultSubcategoryId;
    if (defaultSub && !form.subcategoryId) {
      setForm((f) => ({ ...f, subcategoryId: defaultSub }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory?.id, selectedCategory?.defaultSubcategoryId]);

  const setType = useCallback((type: TransactionType) => {
    const forType    = getCategoriesForType(type);
    const defaultCat = forType[0];
    setForm((f) => ({
      ...f, type,
      categoryId: defaultCat?.id ?? '',
      subcategoryId: defaultCat?.defaultSubcategoryId ?? '',
      installments: 2,
      recurrence: 'one-time',
      transactionMode: 'one-time',
    }));
    setErrors({});
    setEditMode(false);
    setQuickOpen(true);
    setAdditionalOpen(false);
  }, [getCategoriesForType]);

  const setCategory = useCallback((categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    setForm((f) => ({ ...f, categoryId, subcategoryId: cat?.defaultSubcategoryId ?? '' }));
    setErrors((e) => ({ ...e, categoryId: undefined, subcategoryId: undefined }));
  }, [categories]);

  const handleAddSubcategory = useCallback(async (label: string, icon: string) => {
    const newId = await addSubcategory(form.categoryId, label, icon);
    if (newId) setForm((f) => ({ ...f, subcategoryId: newId }));
  }, [addSubcategory, form.categoryId]);

  const handleAddCategory = useCallback(async (cat: Category) => {
    const realId = await addCategory(cat);
    setForm((f) => ({
      ...f,
      type: cat.type as TransactionType,
      categoryId: realId ?? cat.id,
      subcategoryId: cat.defaultSubcategoryId ?? '',
    }));
    if (cat.type === 'expense' && !cat.isQuick) setAdditionalOpen(true);
    setShowNewCategory(false);
  }, [addCategory]);

  // ── Item action menu ─────────────────────────────────────────────

  const handleCategoryMenu = useCallback((id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    // For income, all categories are displayed together — check first overall.
    // For expense, sections are separate — check first within the isQuick section.
    const sectionCats = form.type === 'expense'
      ? categories.filter((c) => c.isQuick === cat.isQuick)
      : categories;
    setMenuTarget({
      kind: 'category', id, icon: cat.icon, label: cat.label,
      isFirst: sectionCats[0]?.id === id,
      isQuick: cat.isQuick,
    });
  }, [categories, form.type]);

  const handleSubcategoryMenu = useCallback((id: string) => {
    const sub = selectedCategory?.subcategories.find((s) => s.id === id);
    if (!sub) return;
    const isDefault = selectedCategory?.defaultSubcategoryId === id;
    setMenuTarget({ kind: 'subcategory', id, icon: sub.icon, label: sub.label, isFirst: isDefault });
  }, [selectedCategory]);

  const handleMenuEdit = useCallback(() => {
    if (!menuTarget) return;
    setEditTarget({ kind: menuTarget.kind, id: menuTarget.id, icon: menuTarget.icon, label: menuTarget.label });
    setMenuTarget(null);
  }, [menuTarget]);

  const handleMenuDelete = useCallback(() => {
    if (!menuTarget) return;
    setDeleteTarget({ kind: menuTarget.kind, id: menuTarget.id });
    setMenuTarget(null);
  }, [menuTarget]);

  const handleMenuMakeDefault = useCallback(() => {
    if (!menuTarget) return;
    if (menuTarget.kind === 'category') {
      let newOrder: string[];
      if (form.type === 'expense') {
        // Expense has two separate sections (quick / additional) — keep them separate.
        const isQ = menuTarget.isQuick ?? true;
        const sectionIds = categories.filter((c) => c.isQuick === isQ).map((c) => c.id);
        const otherIds   = categories.filter((c) => c.isQuick !== isQ).map((c) => c.id);
        const newSection = [menuTarget.id, ...sectionIds.filter((id) => id !== menuTarget.id)];
        newOrder = isQ ? [...newSection, ...otherIds] : [...otherIds, ...newSection];
      } else {
        // Income: all categories displayed together — move selected to absolute first.
        newOrder = [menuTarget.id, ...categories.filter((c) => c.id !== menuTarget.id).map((c) => c.id)];
      }
      reorderCategories(form.type, newOrder);
      setCategory(menuTarget.id);
    } else {
      const subs    = selectedCategory?.subcategories ?? [];
      const newOrder = [menuTarget.id, ...subs.filter((s) => s.id !== menuTarget.id).map((s) => s.id)];
      reorderSubcategories(form.categoryId, newOrder);
      setDefaultSubcategory(form.categoryId, menuTarget.id);
      setForm((f) => ({ ...f, subcategoryId: menuTarget.id }));
      setErrors((e) => ({ ...e, subcategoryId: undefined }));
    }
    setMenuTarget(null);
    setEditMode(false);
  }, [menuTarget, categories, selectedCategory, reorderCategories, reorderSubcategories, setDefaultSubcategory, form.type, form.categoryId, setCategory]);

  const handleMenuMoveSection = useCallback(() => {
    if (!menuTarget || menuTarget.kind !== 'category') return;
    const targetIsQuick = !menuTarget.isQuick;
    moveCategorySection(menuTarget.id, targetIsQuick);
    if (!targetIsQuick) setAdditionalOpen(true);
    setMenuTarget(null);
    setEditMode(false);
  }, [menuTarget, moveCategorySection]);

  // ── Section toggle handlers ──────────────────────────────────────

  const handleToggleQuick = useCallback(() => {
    if (!quickOpen) {
      // Opening: if no quick category is active, select the first quick category
      if (!selectedCategory?.isQuick && quickCats.length > 0) {
        setCategory(quickCats[0].id);
      }
    }
    setQuickOpen((v) => !v);
  }, [quickOpen, selectedCategory, quickCats, setCategory]);

  const handleToggleAdditional = useCallback(() => {
    if (!additionalOpen) {
      // Opening: if no additional category is active, select the first additional category
      if (selectedCategory?.isQuick !== false && additionalCats.length > 0) {
        setCategory(additionalCats[0].id);
      }
    }
    setAdditionalOpen((v) => !v);
  }, [additionalOpen, selectedCategory, additionalCats, setCategory]);

  // ── Edit / Delete confirm ────────────────────────────────────────

  const handleSaveEdit = useCallback((icon: string, label: string) => {
    if (!editTarget) return;
    if (editTarget.kind === 'category') editCategory(editTarget.id, icon, label);
    else editSubcategory(editTarget.id, icon, label);
    setEditTarget(null);
    setEditMode(false);
  }, [editCategory, editSubcategory, editTarget]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'category') {
      archiveCategory(deleteTarget.id);
      if (form.categoryId === deleteTarget.id) {
        const fallback = getCategoriesForType(form.type).find((c) => c.id !== deleteTarget.id);
        setForm((f) => ({ ...f, categoryId: fallback?.id ?? '', subcategoryId: fallback?.defaultSubcategoryId ?? '' }));
      }
    } else {
      const isDeletingDefault = selectedCategory?.defaultSubcategoryId === deleteTarget.id;
      archiveSubcategory(deleteTarget.id);
      const remaining = (selectedCategory?.subcategories ?? []).filter((s) => s.id !== deleteTarget.id);
      if (isDeletingDefault) {
        if (remaining.length > 0) {
          setDefaultSubcategory(form.categoryId, remaining[0].id);
          setForm((f) => ({ ...f, subcategoryId: remaining[0].id }));
        } else {
          setForm((f) => ({ ...f, subcategoryId: '' }));
        }
      } else if (form.subcategoryId === deleteTarget.id) {
        setForm((f) => ({ ...f, subcategoryId: selectedCategory?.defaultSubcategoryId ?? '' }));
      }
    }
    setDeleteTarget(null);
    setEditMode(false);
  }, [archiveCategory, archiveSubcategory, deleteTarget, selectedCategory, setDefaultSubcategory, form.categoryId, form.subcategoryId, form.type]);

  const setTransactionMode = useCallback((mode: TransactionMode) => {
    setForm((f) => ({
      ...f,
      transactionMode: mode,
      installments: mode === 'installments' ? Math.max(2, f.installments) : 2,
      recurrence: 'one-time',
    }));
  }, []);

  const setInstallments = useCallback((installments: number) => {
    setForm((f) => ({ ...f, installments }));
  }, []);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.amount || parseFloat(form.amount) <= 0)
      newErrors.amount = 'נדרש סכום גדול מ-0';
    if (!form.categoryId)
      newErrors.categoryId = 'נדרש לבחור קטגוריה';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const total      = parseFloat(form.amount);
    const selectedSub = selectedCategory?.subcategories.find((s) => s.id === form.subcategoryId);
    const subLabel   = selectedSub?.label ?? '';

    const keepType       = form.type;
    const keepCategoryId = form.categoryId;
    const keepSubId      = selectedCategory?.defaultSubcategoryId ?? '';

    const finish = () => {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setForm({
          ...defaultForm(),
          type: keepType,
          categoryId: keepCategoryId,
          subcategoryId: keepSubId,
        });
        setAdvancedOpen(false);
        setErrors({});
      }, 700);
    };

    if (form.type === 'expense' && form.transactionMode === 'monthly-recurring') {
      const newRule = await addRecurringRule({
        type: form.type,
        amount: total,
        categoryLabel: selectedCategory?.label ?? '',
        subcategoryLabel: subLabel,
        description: form.description,
        startDate: form.date,
        dayOfMonth: new Date(form.date + 'T00:00:00').getDate(),
        categoryNumericId: selectedCategory?.numericId ?? null,
        subcategoryNumericId: selectedSub?.numericId ?? null,
      });
      if (newRule) {
        const txsToAdd = buildRecurringTransactionsForRule(newRule, new Set());
        if (txsToAdd.length > 0) await addTransactions(txsToAdd);
      }
      finish();
      return;
    }

    type BaseFields = Omit<Transaction,
      'id' | 'amount' | 'date' |
      'installmentGroupId' | 'installmentIndex' | 'installmentTotal' |
      'recurrenceGroupId'  | 'recurrenceIndex'  | 'recurrenceTotal'
    >;
    const base: BaseFields = {
      type: form.type,
      categoryId: form.categoryId,
      categoryLabel: selectedCategory?.label ?? '',
      subcategoryId: form.subcategoryId || undefined,
      subcategoryLabel: subLabel,
      description: form.description,
      installments: form.transactionMode === 'installments' ? form.installments : 1,
      recurrence: 'one-time',
      categoryNumericId: selectedCategory?.numericId ?? null,
      subcategoryNumericId: selectedSub?.numericId ?? null,
    };

    const ts = Date.now();
    let newTransactions: Transaction[];

    if (form.type === 'expense' && form.transactionMode === 'installments') {
      const amounts = splitInstallments(total, form.installments);
      const groupId = `grp-${ts}`;
      newTransactions = amounts.map((amt, i) => ({
        ...base,
        id: `tx-${ts}-${i}`,
        amount: amt,
        date: addMonths(form.date, i),
        installmentGroupId: groupId,
        installmentIndex: i + 1,
        installmentTotal: form.installments,
      }));
    } else {
      newTransactions = [{ ...base, id: `tx-${ts}`, amount: total, date: form.date }];
    }

    addTransactions(newTransactions);
    finish();
  };

  const amountNum = parseFloat(form.amount) || 0;
  const perInstallment =
    form.type === 'expense' && form.transactionMode === 'installments' && amountNum > 0
      ? (amountNum / form.installments).toLocaleString('he-IL', { maximumFractionDigits: 2 })
      : null;

  // Move section label for the action menu
  const moveSectionLabel = menuTarget?.kind === 'category' && form.type === 'expense'
    ? (menuTarget.isQuick ? 'העבר לנוספים' : 'העבר לשכיחים')
    : undefined;

  const scrollToCard = (idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.children[idx] as HTMLElement;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
    setView(NAV_CARDS[idx].view);
  };

  return (
    <div className="screen">
      <header className="app-header">
        <span className="app-title">Trackly</span>
      </header>

      {view === 'history' ? (
        <TransactionList
          transactions={transactions}
          categories={allCategories}
          recurringRules={recurringRules}
          onDelete={removeTransaction}
          onDeleteGroup={removeGroup}
          onUpdate={updateTransaction}
          onUpdateGroup={updateTransactionGroup}
          onUpdateRecurringRule={updateRecurringRule}
          onDeactivateRecurringRule={deactivateRecurringRule}
          onUpdateInstallmentDates={updateInstallmentDates}
        />
      ) : view === 'dashboard' ? (
        <Dashboard transactions={transactions} categories={allCategories} recurringRules={recurringRules} />
      ) : (
        <>
          <div className="type-toggle">
            <button
              className={`toggle-btn${form.type === 'expense' ? ' active expense' : ''}`}
              onClick={() => setType('expense')}
            >הוצאה</button>
            <button
              className={`toggle-btn${form.type === 'income' ? ' active income' : ''}`}
              onClick={() => setType('income')}
            >הכנסה</button>
          </div>

          <AmountInput
            value={form.amount}
            onChange={(v) => {
              setForm((f) => ({ ...f, amount: v }));
              setErrors((e) => ({ ...e, amount: undefined }));
            }}
            error={errors.amount}
            type={form.type}
          />

          {perInstallment && (
            <div className="installment-hint">
              {form.installments} תשלומים · {perInstallment} ₪ לכל תשלום
            </div>
          )}

          <AdvancedSection
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((v) => !v)}
            description={form.description}
            onDescriptionChange={(v) => setForm((f) => ({ ...f, description: v }))}
            date={form.date}
            onDateChange={(v) => setForm((f) => ({ ...f, date: v }))}
            type={form.type}
            transactionMode={form.transactionMode}
            onTransactionModeChange={setTransactionMode}
            installments={form.installments}
            onInstallmentsChange={setInstallments}
          />

          {/* ── Category sections ── */}
          {categoriesLoading && (
            <div className="category-area" style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
              טוען קטגוריות...
            </div>
          )}
          <div ref={categoryAreaRef} className={`category-area${editMode ? ' editing' : ''}`} style={categoriesLoading ? { display: 'none' } : undefined}>
          {form.type === 'expense' ? (
            <>
              {/* Quick section — collapsible */}
              {quickCats.length > 0 && (
                <>
                  <button
                    className="section-toggle"
                    onClick={handleToggleQuick}
                    type="button"
                  >
                    <svg className={`chevron-icon${quickOpen ? ' open' : ''}`} viewBox="0 0 12 12" fill="none">
                      <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>שכיחים</span>
                  </button>
                  {quickOpen && (
                    <CategoryGrid
                      categories={quickCats}
                      selectedId={form.categoryId}
                      onSelect={(id) => setCategory(id)}
                      type={form.type}
                      onAddCategory={() => setShowNewCategory(true)}
                      onItemMenu={handleCategoryMenu}
                      onEnterEditMode={() => setEditMode(true)}
                      editMode={editMode}
                      showAddButton
                      error={errors.categoryId}
                    />
                  )}
                </>
              )}

              {/* Sub row for quick-section category — hidden when section is collapsed */}
              {selectedCategory && selectedCategory.isQuick && quickOpen && (
                <SubcategoryRow
                  subcategories={selectedCategory.subcategories}
                  selectedId={form.subcategoryId}
                  onSelect={(id) => {
                    setForm((f) => ({ ...f, subcategoryId: id }));
                    setErrors((e) => ({ ...e, subcategoryId: undefined }));
                  }}
                  onAdd={handleAddSubcategory}
                  onItemMenu={handleSubcategoryMenu}
                  onEnterEditMode={() => setEditMode(true)}
                  editMode={editMode}
                  type={form.type}
                  parentIcon={selectedCategory.icon}
                />
              )}

              {/* Additional section — toggle outside content wrapper */}
              {additionalCats.length > 0 && (
                <>
                  <button
                    className="section-toggle"
                    onClick={handleToggleAdditional}
                    type="button"
                  >
                    <svg className={`chevron-icon${additionalOpen ? ' open' : ''}`} viewBox="0 0 12 12" fill="none">
                      <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>נוספים</span>
                  </button>
                  {additionalOpen && (
                    <div className="additional-section">
                      <CategoryGrid
                        categories={additionalCats}
                        selectedId={form.categoryId}
                        onSelect={(id) => setCategory(id)}
                        type={form.type}
                        onAddCategory={() => setShowNewCategory(true)}
                        onItemMenu={handleCategoryMenu}
                        onEnterEditMode={() => setEditMode(true)}
                        editMode={editMode}
                        showAddButton
                      />
                    </div>
                  )}
                </>
              )}

              {/* Sub row for additional-section category — hidden when section is collapsed */}
              {selectedCategory && !selectedCategory.isQuick && additionalOpen && (
                <SubcategoryRow
                  subcategories={selectedCategory.subcategories}
                  selectedId={form.subcategoryId}
                  onSelect={(id) => {
                    setForm((f) => ({ ...f, subcategoryId: id }));
                    setErrors((e) => ({ ...e, subcategoryId: undefined }));
                  }}
                  onAdd={handleAddSubcategory}
                  onItemMenu={handleSubcategoryMenu}
                  onEnterEditMode={() => setEditMode(true)}
                  editMode={editMode}
                  type={form.type}
                  parentIcon={selectedCategory.icon}
                />
              )}

              {additionalCats.length === 0 && !editMode && (
                <div className="cat-add-row" style={{ margin: '10px 20px 0' }}>
                  <button className="cat-add-link" onClick={() => setShowNewCategory(true)} type="button">
                    ＋ קטגוריה חדשה
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <CategoryGrid
                categories={quickCats}
                selectedId={form.categoryId}
                onSelect={(id) => setCategory(id)}
                type={form.type}
                onAddCategory={() => setShowNewCategory(true)}
                onItemMenu={handleCategoryMenu}
                onEnterEditMode={() => setEditMode(true)}
                editMode={editMode}
                showAddButton
                error={errors.categoryId}
              />
              {selectedCategory && (
                <SubcategoryRow
                  subcategories={selectedCategory.subcategories}
                  selectedId={form.subcategoryId}
                  onSelect={(id) => {
                    setForm((f) => ({ ...f, subcategoryId: id }));
                    setErrors((e) => ({ ...e, subcategoryId: undefined }));
                  }}
                  onAdd={handleAddSubcategory}
                  onItemMenu={handleSubcategoryMenu}
                  onEnterEditMode={() => setEditMode(true)}
                  editMode={editMode}
                  type={form.type}
                  parentIcon={selectedCategory.icon}
                />
              )}
            </>
          )}
          </div>

        </>
      )}

      {/* FAB — only in entry view, hidden in edit mode */}
      {view === 'entry' && !editMode && (
        <button
          className={`fab${saved ? ' fab-saved' : ''}${form.type === 'income' ? ' fab-income' : ''}`}
          onClick={handleSave}
          disabled={saved}
          aria-label="הוסף דיווח"
        >
          {saved ? '✓ נשמר' : 'הוסף'}
        </button>
      )}


      {showNewCategory && (
        <NewCategoryModal
          defaultType={form.type}
          onSave={handleAddCategory}
          onClose={() => setShowNewCategory(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === 'category' ? 'מחיקת קטגוריה' : 'מחיקת תת קטגוריה'}
          message="האם אתה בטוח שברצונך למחוק?"
          confirmLabel="מחק"
          cancelLabel="ביטול"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {editTarget && (
        <EditItemModal
          kind={editTarget.kind}
          icon={editTarget.icon}
          label={editTarget.label}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {menuTarget && (
        <ItemActionMenu
          icon={menuTarget.icon}
          label={menuTarget.label}
          isFirst={menuTarget.isFirst}
          onEdit={handleMenuEdit}
          onDelete={handleMenuDelete}
          onMakeDefault={handleMenuMakeDefault}
          onMoveSection={moveSectionLabel ? handleMenuMoveSection : undefined}
          moveSectionLabel={moveSectionLabel}
          onClose={() => setMenuTarget(null)}
        />
      )}

      <div className="nav-carousel-wrap">
        <div className="nav-carousel" ref={carouselRef}>
          {NAV_CARDS.map((card, idx) => (
            <button
              key={card.view}
              className={`nav-card${view === card.view ? ' active' : ''}`}
              onClick={() => scrollToCard(idx)}
              type="button"
            >
              {card.icon}
              <span className="nav-card-label">{card.label}</span>
              <span className="nav-card-tagline">{card.tagline}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
