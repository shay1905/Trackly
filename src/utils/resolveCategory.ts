import { Category } from '../types';

// Single source of truth for how a category / subcategory is DISPLAYED.
//
// Transactions and recurring rules store a denormalized *copy* of the
// category/subcategory name and id at the moment they were created. That copy
// goes stale the instant a category is renamed or a subcategory is deleted.
// Every screen must therefore resolve the label + icon LIVE from the categories
// tree (by numeric id), and only fall back to the stored copy for legacy rows
// that were never linked by id.

export interface ResolvedCategory {
  categoryLabel: string;
  categoryIcon: string;
  subcategoryLabel: string;   // '' when the row has no subcategory OR it was deleted
  subcategoryIcon: string;    // '' when there is nothing to show
  subcategoryMissing: boolean; // true when a subcategory id is set but no longer exists
}

export interface CategoryRef {
  categoryNumericId: number | null;
  categoryLabel?: string;
  subcategoryNumericId: number | null;
  subcategoryLabel?: string;
}

export function resolveCategory(ref: CategoryRef, categories: Category[]): ResolvedCategory {
  const cat =
    ref.categoryNumericId != null
      ? categories.find((c) => c.numericId === ref.categoryNumericId)
      : undefined;

  const categoryLabel = cat?.label ?? ref.categoryLabel ?? '';
  const categoryIcon = cat?.icon ?? '🏷️';

  let subcategoryLabel = '';
  let subcategoryIcon = '';
  let subcategoryMissing = false;

  if (ref.subcategoryNumericId != null) {
    const sub = cat?.subcategories.find((s) => s.numericId === ref.subcategoryNumericId);
    if (sub) {
      subcategoryLabel = sub.label;
      subcategoryIcon = sub.icon;
    } else {
      // Deleted subcategory. Do NOT fall back to the stored label and do NOT
      // borrow another subcategory — the association is simply gone.
      subcategoryMissing = true;
    }
  } else if (ref.subcategoryLabel) {
    // Legacy row: had a subcategory name but was never linked by id.
    subcategoryLabel = ref.subcategoryLabel;
    subcategoryIcon = cat?.subcategories.find((s) => s.label === ref.subcategoryLabel)?.icon ?? '';
  }

  return { categoryLabel, categoryIcon, subcategoryLabel, subcategoryIcon, subcategoryMissing };
}
