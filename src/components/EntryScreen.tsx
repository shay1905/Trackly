import { useState, useCallback } from 'react';
import {
  TransactionForm, TransactionType, RecurrenceType, Transaction, Category,
} from '../types';
import {
  getCategoriesForType as getBuiltinCategoriesForType,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../data/categories';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { generateRecurringDates } from '../utils/recurrence';
import CategoryGrid from './CategoryGrid';
import SubcategoryRow from './SubcategoryRow';
import AmountInput from './AmountInput';
import AdvancedSection from './AdvancedSection';
import TransactionList from './TransactionList';
import NewCategoryModal from './NewCategoryModal';
import ConfirmDialog from './ConfirmDialog';
import EditItemModal from './EditItemModal';
import ItemActionMenu from './ItemActionMenu';

const today = () => new Date().toISOString().split('T')[0];

const defaultForm = (): TransactionForm => ({
  type: 'expense',
  amount: '',
  categoryId: 'entertainment',
  subcategoryId: '',
  description: '',
  date: today(),
  installments: 1,
  recurrence: 'one-time',
  recurrenceEndMode: 'occurrences',
  recurrenceOccurrences: 3,
  recurrenceEndDate: '',
});

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

function splitInstallments(total: number, count: number): number[] {
  const base      = Math.floor((total * 100) / count) / 100;
  const amounts   = Array<number>(count).fill(base);
  const remainder = Math.round((total - base * count) * 100) / 100;
  amounts[count - 1] = Math.round((amounts[count - 1] + remainder) * 100) / 100;
  return amounts;
}

type View = 'entry' | 'history';

interface DeleteTarget { kind: 'category' | 'subcategory'; id: string; }
interface EditTarget   { kind: 'category' | 'subcategory'; id: string; icon: string; label: string; }
interface MenuTarget   { kind: 'category' | 'subcategory'; id: string; icon: string; label: string; isFirst: boolean; }

export default function EntryScreen() {
  const [view,            setView]            = useState<View>('entry');
  const [form,            setForm]            = useState<TransactionForm>(defaultForm());
  const [advancedOpen,    setAdvancedOpen]    = useState(false);
  const [errors,          setErrors]          = useState<Partial<Record<keyof TransactionForm, string>>>({});
  const [saved,           setSaved]           = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editMode,        setEditMode]        = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<DeleteTarget | null>(null);
  const [editTarget,      setEditTarget]      = useState<EditTarget   | null>(null);
  const [menuTarget,      setMenuTarget]      = useState<MenuTarget   | null>(null);

  const { transactions, addTransactions, removeTransaction, removeGroup } = useTransactions();
  const {
    addCategory, archiveCategory,
    addSubcategory, archiveSubcategory,
    editCategory, editSubcategory,
    reorderCategories, reorderSubcategories,
    getCategoriesForType, mergeSubcategories,
  } = useCategories();

  const builtinCats = getBuiltinCategoriesForType(form.type);
  const userCats    = getCategoriesForType(form.type);
  const categories  = mergeSubcategories([...builtinCats, ...userCats], form.type);
  const selectedCategory = categories.find((c) => c.id === form.categoryId) ?? null;

  const setType = useCallback((type: TransactionType) => {
    const builtins   = getBuiltinCategoriesForType(type);
    const customs    = getCategoriesForType(type);
    const merged     = mergeSubcategories([...builtins, ...customs], type);
    const defaultCat = merged[0] ?? (type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    setForm((f) => ({
      ...f, type,
      categoryId: defaultCat.id,
      subcategoryId: defaultCat.defaultSubcategoryId ?? '',
      installments: 1,
      recurrence: 'one-time',
    }));
    setErrors({});
    setEditMode(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCategory = useCallback((categoryId: string, currentType: TransactionType) => {
    const allCats = [
      ...getBuiltinCategoriesForType(currentType),
      ...getCategoriesForType(currentType),
    ];
    const cat = allCats.find((c) => c.id === categoryId);
    setForm((f) => ({ ...f, categoryId, subcategoryId: cat?.defaultSubcategoryId ?? '' }));
    setErrors((e) => ({ ...e, categoryId: undefined, subcategoryId: undefined }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSubcategory = useCallback((label: string, icon: string) => {
    const newId = addSubcategory(form.categoryId, label, icon);
    setForm((f) => ({ ...f, subcategoryId: newId }));
  }, [addSubcategory, form.categoryId]);

  const handleAddCategory = useCallback((cat: Category) => {
    addCategory(cat);
    setForm((f) => ({
      ...f,
      type: cat.type as TransactionType,
      categoryId: cat.id,
      subcategoryId: cat.defaultSubcategoryId ?? '',
    }));
    setShowNewCategory(false);
  }, [addCategory]);

  // ── Item action menu ─────────────────────────────────────────────

  const handleCategoryMenu = useCallback((id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setMenuTarget({ kind: 'category', id, icon: cat.icon, label: cat.label, isFirst: categories[0]?.id === id });
  }, [categories]);

  const handleSubcategoryMenu = useCallback((id: string) => {
    const sub = selectedCategory?.subcategories.find((s) => s.id === id);
    if (!sub) return;
    const isFirst = selectedCategory?.subcategories[0]?.id === id;
    setMenuTarget({ kind: 'subcategory', id, icon: sub.icon, label: sub.label, isFirst });
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
      const newOrder = [menuTarget.id, ...categories.filter((c) => c.id !== menuTarget.id).map((c) => c.id)];
      reorderCategories(form.type, newOrder);
      setCategory(menuTarget.id, form.type);
    } else {
      const subs = selectedCategory?.subcategories ?? [];
      const newOrder = [menuTarget.id, ...subs.filter((s) => s.id !== menuTarget.id).map((s) => s.id)];
      reorderSubcategories(form.categoryId, newOrder);
      setForm((f) => ({ ...f, subcategoryId: menuTarget.id }));
      setErrors((e) => ({ ...e, subcategoryId: undefined }));
    }
    setMenuTarget(null);
  }, [menuTarget, categories, selectedCategory, reorderCategories, reorderSubcategories, form.type, form.categoryId, setCategory]);

  // ── Edit / Delete confirm ────────────────────────────────────────

  const handleSaveEdit = useCallback((icon: string, label: string) => {
    if (!editTarget) return;
    if (editTarget.kind === 'category') editCategory(editTarget.id, icon, label);
    else editSubcategory(editTarget.id, icon, label);
    setEditTarget(null);
  }, [editCategory, editSubcategory, editTarget]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'category') {
      archiveCategory(deleteTarget.id);
      if (form.categoryId === deleteTarget.id) {
        const defaultCat = form.type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
        setForm((f) => ({ ...f, categoryId: defaultCat.id, subcategoryId: defaultCat.defaultSubcategoryId ?? '' }));
      }
    } else {
      archiveSubcategory(deleteTarget.id);
      if (form.subcategoryId === deleteTarget.id) {
        setForm((f) => ({ ...f, subcategoryId: '' }));
      }
    }
    setDeleteTarget(null);
  }, [archiveCategory, archiveSubcategory, deleteTarget, form.categoryId, form.subcategoryId, form.type]);

  const setInstallments = useCallback((installments: number) => {
    setForm((f) => ({
      ...f, installments,
      recurrence: installments > 1 ? 'one-time' : f.recurrence,
    }));
  }, []);

  const setRecurrence = useCallback((recurrence: RecurrenceType) => {
    setForm((f) => ({
      ...f, recurrence,
      installments: recurrence !== 'one-time' ? 1 : f.installments,
    }));
  }, []);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.amount || parseFloat(form.amount) <= 0)
      newErrors.amount = 'נדרש סכום גדול מ-0';
    if (!form.categoryId)
      newErrors.categoryId = 'נדרש לבחור קטגוריה';
    if (
      selectedCategory && !selectedCategory.isQuick &&
      selectedCategory.subcategories.length > 0 && !form.subcategoryId
    )
      newErrors.subcategoryId = 'נדרש לבחור תת קטגוריה';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const total    = parseFloat(form.amount);
    const subLabel = selectedCategory?.subcategories.find((s) => s.id === form.subcategoryId)?.label ?? '';

    type BaseFields = Omit<Transaction,
      'id' | 'amount' | 'date' |
      'installmentGroupId' | 'installmentIndex' | 'installmentTotal' |
      'recurrenceGroupId'  | 'recurrenceIndex'  | 'recurrenceTotal'
    >;
    const base: BaseFields = {
      type: form.type,
      categoryId: form.categoryId,
      categoryLabel: selectedCategory?.label ?? '',
      categoryIcon: selectedCategory?.icon ?? '',
      subcategoryId: form.subcategoryId,
      subcategoryLabel: subLabel,
      description: form.description,
      installments: form.installments,
      recurrence: form.recurrence,
      createdAt: new Date().toISOString(),
    };

    const ts = Date.now();
    let newTransactions: Transaction[];

    if (form.type === 'expense' && form.installments > 1) {
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
    } else if (form.type === 'expense' && form.recurrence !== 'one-time') {
      const dates = generateRecurringDates(
        form.date, form.recurrence,
        form.recurrenceEndMode, form.recurrenceOccurrences, form.recurrenceEndDate,
      );
      const groupId = `rec-${ts}`;
      newTransactions = dates.map((date, i) => ({
        ...base, id: `tx-${ts}-${i}`, amount: total, date,
        recurrenceGroupId: groupId, recurrenceIndex: i + 1, recurrenceTotal: dates.length,
      }));
    } else {
      newTransactions = [{ ...base, id: `tx-${ts}`, amount: total, date: form.date }];
    }

    addTransactions(newTransactions);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm(defaultForm());
      setAdvancedOpen(false);
      setErrors({});
    }, 900);
  };

  const amountNum = parseFloat(form.amount) || 0;
  const perInstallment =
    form.type === 'expense' && form.installments > 1 && amountNum > 0
      ? (amountNum / form.installments).toLocaleString('he-IL', { maximumFractionDigits: 2 })
      : null;

  return (
    <div className="screen">
      <header className="app-header">
        <span className="app-title">Trackly</span>
        <div className="header-nav">
          <button
            className={`nav-btn${view === 'entry' ? ' active' : ''}`}
            onClick={() => setView('entry')}
            title="הוספת עסקה"
          >✚</button>
          <button
            className={`nav-btn${view === 'history' ? ' active' : ''}`}
            onClick={() => setView('history')}
            title="היסטוריה"
          >
            ☰
            {transactions.length > 0 && view !== 'history' && (
              <span className="nav-badge">
                {transactions.length > 99 ? '99+' : transactions.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {view === 'history' ? (
        <TransactionList
          transactions={transactions}
          onDelete={removeTransaction}
          onDeleteGroup={removeGroup}
        />
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

          <CategoryGrid
            categories={categories}
            selectedId={form.categoryId}
            onSelect={(id) => setCategory(id, form.type)}
            type={form.type}
            onAddCategory={() => setShowNewCategory(true)}
            onItemMenu={handleCategoryMenu}
            onEnterEditMode={() => setEditMode(true)}
            onExitEditMode={() => setEditMode(false)}
            editMode={editMode}
            error={errors.categoryId}
          />

          {selectedCategory && !selectedCategory.isQuick && selectedCategory.subcategories.length > 0 && (
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
              error={errors.subcategoryId}
            />
          )}

          <AdvancedSection
            open={advancedOpen}
            onToggle={() => setAdvancedOpen((v) => !v)}
            description={form.description}
            onDescriptionChange={(v) => setForm((f) => ({ ...f, description: v }))}
            date={form.date}
            onDateChange={(v) => setForm((f) => ({ ...f, date: v }))}
            installments={form.installments}
            onInstallmentsChange={setInstallments}
            recurrence={form.recurrence}
            onRecurrenceChange={setRecurrence}
            recurrenceEndMode={form.recurrenceEndMode}
            onRecurrenceEndModeChange={(v) => setForm((f) => ({ ...f, recurrenceEndMode: v }))}
            recurrenceOccurrences={form.recurrenceOccurrences}
            onRecurrenceOccurrencesChange={(v) => setForm((f) => ({ ...f, recurrenceOccurrences: v }))}
            recurrenceEndDate={form.recurrenceEndDate}
            onRecurrenceEndDateChange={(v) => setForm((f) => ({ ...f, recurrenceEndDate: v }))}
            type={form.type}
          />

          {editMode ? (
            <div className="save-btn edit-mode-save-placeholder">
              מצב עריכה פעיל
            </div>
          ) : (
            <button
              className={`save-btn${saved ? ' saved' : ''}${form.type === 'income' ? ' income' : ''}`}
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? '✓ נשמר!' : 'שמור'}
            </button>
          )}
        </>
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
          onClose={() => setMenuTarget(null)}
        />
      )}
    </div>
  );
}
