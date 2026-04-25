import { useState, useEffect, useCallback } from 'react';
import { Category, TransactionType } from '../types';
import { supabase } from '../lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCategories(catRows: any[], subRows: any[]): Category[] {
  return catRows
    .filter((c) => !c.is_archived)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => {
      const subs = subRows
        .filter((s) => s.category_id === c.id && !s.is_archived)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ id: String(s.id), numericId: s.id as number, label: s.label as string, icon: s.icon as string }));
      const defaultSub = subRows.find(
        (s) => s.category_id === c.id && s.is_default && !s.is_archived,
      );
      return {
        id: String(c.id),
        numericId: c.id as number,
        label: c.label as string,
        icon: c.icon as string,
        isQuick: c.is_quick as boolean,
        type: c.type as 'expense' | 'income',
        subcategories: subs,
        defaultSubcategoryId: defaultSub ? String(defaultSub.id) : undefined,
      };
    });
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const [{ data: catRows, error: catErr }, { data: subRows, error: subErr }] = await Promise.all([
      supabase.from('categories').select('*').eq('is_deleted', false).order('sort_order'),
      supabase.from('subcategories').select('*').eq('is_deleted', false).order('sort_order'),
    ]);
    if (catErr || subErr) {
      console.error('Failed loading categories:', catErr ?? subErr);
      setLoading(false);
      return;
    }
    setCategories(buildCategories(catRows ?? [], subRows ?? []));
    setLoading(false);
  }

  const getCategoriesForType = useCallback(
    (type: TransactionType) => categories.filter((c) => c.type === type || c.type === 'both'),
    [categories],
  );

  async function addCategory(cat: Category): Promise<string | undefined> {
    const sameType = categories.filter((c) => c.type === cat.type);
    const { data, error } = await supabase.from('categories').insert({
      type: cat.type,
      label: cat.label,
      icon: cat.icon,
      is_quick: cat.isQuick,
      sort_order: sameType.length + 1,
    }).select().single();
    if (error) { console.error('Failed adding category:', error); return undefined; }
    const realId = String(data.id);
    setCategories((prev) => [...prev, { ...cat, id: realId, numericId: data.id as number, subcategories: [] }]);
    return realId;
  }

  function archiveCategory(id: string) {
    void supabase.from('categories').update({ is_archived: true, is_deleted: true }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed archiving category:', error); });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function addSubcategory(categoryId: string, label: string, icon: string): Promise<string> {
    const cat = categories.find((c) => c.id === categoryId);
    const isFirst = (cat?.subcategories?.length ?? 0) === 0;
    const { data, error } = await supabase.from('subcategories').insert({
      category_id: cat?.numericId ?? Number(categoryId),
      label,
      icon,
      sort_order: (cat?.subcategories?.length ?? 0) + 1,
      is_default: isFirst,
    }).select().single();
    if (error) { console.error('Failed adding subcategory:', error); return ''; }
    const realId = String(data.id);
    setCategories((prev) => prev.map((c) => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        subcategories: [...(c.subcategories || []), { id: realId, numericId: data.id as number, label, icon }],
        defaultSubcategoryId: isFirst ? realId : c.defaultSubcategoryId,
      };
    }));
    return realId;
  }

  function archiveSubcategory(id: string) {
    void supabase.from('subcategories').update({ is_archived: true, is_deleted: true }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed archiving subcategory:', error); });
    setCategories((prev) => prev.map((c) => ({
      ...c,
      subcategories: (c.subcategories || []).filter((s) => s.id !== id),
      defaultSubcategoryId: c.defaultSubcategoryId === id
        ? (c.subcategories || []).find((s) => s.id !== id)?.id
        : c.defaultSubcategoryId,
    })));
  }

  function editCategory(id: string, icon: string, label: string) {
    void supabase.from('categories').update({ icon, label }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed editing category:', error); });
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, icon, label } : c));
  }

  function editSubcategory(id: string, icon: string, label: string) {
    void supabase.from('subcategories').update({ icon, label }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed editing subcategory:', error); });
    setCategories((prev) => prev.map((c) => ({
      ...c,
      subcategories: (c.subcategories || []).map((s) => s.id === id ? { ...s, icon, label } : s),
    })));
  }

  function setDefaultSubcategory(categoryId: string, subId: string) {
    void supabase.from('subcategories').update({ is_default: false }).eq('category_id', categoryId)
      .then(() => supabase.from('subcategories').update({ is_default: true }).eq('id', subId))
      .then(({ error }) => { if (error) console.error('Failed setting default subcategory:', error); });
    setCategories((prev) => prev.map((c) =>
      c.id === categoryId ? { ...c, defaultSubcategoryId: subId } : c));
  }

  function moveCategorySection(id: string, isQuick: boolean) {
    void supabase.from('categories').update({ is_quick: isQuick }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed moving category section:', error); });
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, isQuick } : c));
  }

  function reorderCategories(_type: TransactionType, orderedIds: string[]) {
    orderedIds.forEach((id, i) => {
      void supabase.from('categories').update({ sort_order: i + 1 }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Failed reordering category:', error); });
    });
    const idSet = new Set(orderedIds);
    setCategories((prev) => {
      const ordered = orderedIds.flatMap((id) => {
        const cat = prev.find((c) => c.id === id);
        return cat ? [cat] : [];
      });
      const rest = prev.filter((c) => !idSet.has(c.id));
      return [...ordered, ...rest];
    });
  }

  function reorderSubcategories(categoryId: string, orderedIds: string[]) {
    orderedIds.forEach((id, i) => {
      void supabase.from('subcategories').update({ sort_order: i + 1 }).eq('id', id)
        .then(({ error }) => { if (error) console.error('Failed reordering subcategory:', error); });
    });
    setCategories((prev) => prev.map((c) => {
      if (c.id !== categoryId) return c;
      const byId = new Map((c.subcategories || []).map((s) => [s.id, s]));
      return {
        ...c,
        subcategories: orderedIds.flatMap((id) => {
          const s = byId.get(id);
          return s ? [s] : [];
        }),
      };
    }));
  }

  return {
    categories,
    loading,
    getCategoriesForType,
    addCategory,
    archiveCategory,
    addSubcategory,
    archiveSubcategory,
    editCategory,
    editSubcategory,
    setDefaultSubcategory,
    moveCategorySection,
    reorderCategories,
    reorderSubcategories,
  };
}
