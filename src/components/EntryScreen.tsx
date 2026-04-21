import { useState, useCallback, useEffect, useRef } from 'react';
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
interface MenuTarget   {
  kind: 'category' | 'subcategory';
  id: string; icon: string; label: string;
  isFirst: boolean;
  isQuick?: boolean;
}

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

  const { transactions, addTransactions, removeTransaction, removeGroup } = useTransactions();
  const {
    addCategory, archiveCategory,
    addSubcategory, archiveSubcategory,
    editCategory, editSubcategory,
    setDefaultSubcategory,
    moveCategorySection,
    reorderCategories, reorderSubcategories,
    getCategoriesForType, mergeSubcategories,
  } = useCategories();

  const builtinCats = getBuiltinCategoriesForType(form.type);
  const userCats    = getCategoriesForType(form.type);
  const categories  = mergeSubcategories([...builtinCats, ...userCats], form.type);

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
    setQuickOpen(true);
    setAdditionalOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCategory = useCallback((categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    setForm((f) => ({ ...f, categoryId, subcategoryId: cat?.defaultSubcategoryId ?? '' }));
    setErrors((e) => ({ ...e, categoryId: undefined, subcategoryId: undefined }));
  }, [categories]);

  const handleAddSubcategory = useCallback((label: string, icon: string) => {
    const newId = addSubcategory(form.categoryId, label, icon);
    const isFirst = (selectedCategory?.subcategories.length ?? 0) === 0;
    if (isFirst) setDefaultSubcategory(form.categoryId, newId);
    setForm((f) => ({ ...f, subcategoryId: newId }));
  }, [addSubcategory, setDefaultSubcategory, form.categoryId, selectedCategory]);

  const handleAddCategory = useCallback((cat: Category) => {
    addCategory(cat);
    setForm((f) => ({
      ...f,
      type: cat.type as TransactionType,
      categoryId: cat.id,
      subcategoryId: cat.defaultSubcategoryId ?? '',
    }));
    if (cat.type === 'expense' && !cat.isQuick) setAdditionalOpen(true);
    setShowNewCategory(false);
  }, [addCategory]);

  // ── Item action menu ─────────────────────────────────────────────

  const handleCategoryMenu = useCallback((id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    const sectionCats = categories.filter((c) => c.isQuick === cat.isQuick);
    setMenuTarget({
      kind: 'category', id, icon: cat.icon, label: cat.label,
      isFirst: sectionCats[0]?.id === id,
      isQuick: cat.isQuick,
    });
  }, [categories]);

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
      const isQ = menuTarget.isQuick ?? true;
      const sectionIds = categories.filter((c) => c.isQuick === isQ).map((c) => c.id);
      const otherIds   = categories.filter((c) => c.isQuick !== isQ).map((c) => c.id);
      const newSection = [menuTarget.id, ...sectionIds.filter((id) => id !== menuTarget.id)];
      const newOrder   = isQ ? [...newSection, ...otherIds] : [...otherIds, ...newSection];
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
        const defaultCat = form.type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
        setForm((f) => ({ ...f, categoryId: defaultCat.id, subcategoryId: defaultCat.defaultSubcategoryId ?? '' }));
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

    const keepType       = form.type;
    const keepCategoryId = form.categoryId;
    const keepSubId      = selectedCategory?.defaultSubcategoryId ?? '';

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

  const amountNum = parseFloat(form.amount) || 0;
  const perInstallment =
    form.type === 'expense' && form.installments > 1 && amountNum > 0
      ? (amountNum / form.installments).toLocaleString('he-IL', { maximumFractionDigits: 2 })
      : null;

  // Move section label for the action menu
  const moveSectionLabel = menuTarget?.kind === 'category' && form.type === 'expense'
    ? (menuTarget.isQuick ? 'העבר לנוספים' : 'העבר לשכיחים')
    : undefined;

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

          {/* ── Category sections ── */}
          <div ref={categoryAreaRef} className={`category-area${editMode ? ' editing' : ''}`}>
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
    </div>
  );
}
