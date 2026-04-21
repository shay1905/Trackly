import { useState, useEffect } from 'react';
import { Category, Subcategory, TransactionType } from '../types';

const CATS_KEY        = 'trackly_custom_categories';
const SUBS_KEY        = 'trackly_custom_subs';
const ARC_CATS_KEY    = 'trackly_archived_cat_ids';
const ARC_SUBS_KEY    = 'trackly_archived_sub_ids';
const CAT_ORDER_KEY   = 'trackly_cat_order';
const SUB_ORDER_KEY   = 'trackly_sub_order';
const CAT_EDITS_KEY   = 'trackly_cat_edits';
const SUB_EDITS_KEY   = 'trackly_sub_edits';
const CAT_SECTION_KEY = 'trackly_cat_section';

type EditOverride = { icon: string; label: string };

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items;
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export function useCategories() {
  const [customCategories, setCustomCategories] = useState<Category[]>(() =>
    loadJSON<Category[]>(CATS_KEY, []));
  const [customSubs, setCustomSubs] = useState<Record<string, Subcategory[]>>(() =>
    loadJSON<Record<string, Subcategory[]>>(SUBS_KEY, {}));
  const [archivedCatIds, setArchivedCatIds] = useState<string[]>(() =>
    loadJSON<string[]>(ARC_CATS_KEY, []));
  const [archivedSubIds, setArchivedSubIds] = useState<string[]>(() =>
    loadJSON<string[]>(ARC_SUBS_KEY, []));
  const [catOrder, setCatOrder] = useState<Record<string, string[]>>(() =>
    loadJSON<Record<string, string[]>>(CAT_ORDER_KEY, {}));
  const [subOrder, setSubOrder] = useState<Record<string, string[]>>(() =>
    loadJSON<Record<string, string[]>>(SUB_ORDER_KEY, {}));
  const [catEdits, setCatEdits] = useState<Record<string, EditOverride>>(() =>
    loadJSON<Record<string, EditOverride>>(CAT_EDITS_KEY, {}));
  const [subEdits, setSubEdits] = useState<Record<string, EditOverride>>(() =>
    loadJSON<Record<string, EditOverride>>(SUB_EDITS_KEY, {}));
  const [catSection, setCatSection] = useState<Record<string, boolean>>(() =>
    loadJSON<Record<string, boolean>>(CAT_SECTION_KEY, {}));

  useEffect(() => { localStorage.setItem(CATS_KEY,        JSON.stringify(customCategories)); }, [customCategories]);
  useEffect(() => { localStorage.setItem(SUBS_KEY,        JSON.stringify(customSubs));       }, [customSubs]);
  useEffect(() => { localStorage.setItem(ARC_CATS_KEY,    JSON.stringify(archivedCatIds));   }, [archivedCatIds]);
  useEffect(() => { localStorage.setItem(ARC_SUBS_KEY,    JSON.stringify(archivedSubIds));   }, [archivedSubIds]);
  useEffect(() => { localStorage.setItem(CAT_ORDER_KEY,   JSON.stringify(catOrder));         }, [catOrder]);
  useEffect(() => { localStorage.setItem(SUB_ORDER_KEY,   JSON.stringify(subOrder));         }, [subOrder]);
  useEffect(() => { localStorage.setItem(CAT_EDITS_KEY,   JSON.stringify(catEdits));         }, [catEdits]);
  useEffect(() => { localStorage.setItem(SUB_EDITS_KEY,   JSON.stringify(subEdits));         }, [subEdits]);
  useEffect(() => { localStorage.setItem(CAT_SECTION_KEY, JSON.stringify(catSection));       }, [catSection]);

  const addCategory = (cat: Category) =>
    setCustomCategories((prev) => [...prev, cat]);

  const archiveCategory = (id: string) =>
    setArchivedCatIds((prev) => Array.from(new Set([...prev, id])));

  const addSubcategory = (categoryId: string, label: string, icon: string): string => {
    const newId = `custom-sub-${Date.now()}`;
    setCustomSubs((prev) => ({
      ...prev,
      [categoryId]: [...(prev[categoryId] ?? []), { id: newId, label, icon }],
    }));
    return newId;
  };

  const archiveSubcategory = (id: string) =>
    setArchivedSubIds((prev) => Array.from(new Set([...prev, id])));

  const editCategory = (id: string, icon: string, label: string) =>
    setCatEdits((prev) => ({ ...prev, [id]: { icon, label } }));

  const moveCategorySection = (id: string, isQuick: boolean) =>
    setCatSection((prev) => ({ ...prev, [id]: isQuick }));

  const editSubcategory = (id: string, icon: string, label: string) =>
    setSubEdits((prev) => ({ ...prev, [id]: { icon, label } }));

  const reorderCategories = (type: TransactionType, orderedIds: string[]) =>
    setCatOrder((prev) => ({ ...prev, [type]: orderedIds }));

  const reorderSubcategories = (categoryId: string, orderedIds: string[]) =>
    setSubOrder((prev) => ({ ...prev, [categoryId]: orderedIds }));

  const getCategoriesForType = (type: TransactionType) =>
    customCategories.filter(
      (c) => (c.type === type || c.type === 'both') && !archivedCatIds.includes(c.id)
    );

  const mergeSubcategories = (cats: Category[], type?: TransactionType): Category[] => {
    const filtered = cats.filter((cat) => !archivedCatIds.includes(cat.id));

    const withSubs = filtered.map((cat) => {
      const catEdit   = catEdits[cat.id];
      const baseMerge = catEdit ? { ...cat, icon: catEdit.icon, label: catEdit.label } : cat;
      const sectionOverride = catSection[cat.id];
      const mergedCat = sectionOverride !== undefined
        ? { ...baseMerge, isQuick: sectionOverride }
        : baseMerge;

      const applySubEdit = (s: Subcategory) => {
        const e = subEdits[s.id];
        return e ? { ...s, icon: e.icon, label: e.label } : s;
      };

      const baseSubs  = cat.subcategories
        .filter((s) => !archivedSubIds.includes(s.id))
        .map(applySubEdit);
      const extraSubs = (customSubs[cat.id] ?? [])
        .filter((s) => !archivedSubIds.includes(s.id))
        .map(applySubEdit);

      const allSubs = [...baseSubs, ...extraSubs];
      const order   = subOrder[cat.id];
      return { ...mergedCat, subcategories: order ? applyOrder(allSubs, order) : allSubs };
    });

    if (type) {
      const order = catOrder[type];
      return order ? applyOrder(withSubs, order) : withSubs;
    }
    return withSubs;
  };

  return {
    customCategories,
    addCategory,
    archiveCategory,
    addSubcategory,
    archiveSubcategory,
    editCategory,
    editSubcategory,
    moveCategorySection,
    reorderCategories,
    reorderSubcategories,
    getCategoriesForType,
    mergeSubcategories,
  };
}
