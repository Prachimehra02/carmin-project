import { supabase } from "../lib/supabase";

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image_url: string | null;
  description: string | null;
  menu_order: number;
}

export async function getActiveCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select(`
      id,
      name,
      slug,
      parent_id,
      image_url,
      description,
      menu_order
    `)
    .eq("active", true)
    .order("menu_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}


/**
 * Builds a hierarchical URL for a category.
 *
 * Example:
 * Home Decor → Vases → Indoor Vases
 *
 * /category/home-decor/vases/indoor-vases
 */
export function getCategoryUrl(
  category: Category,
  categories: Category[]
): string {
  const segments: string[] = [];
  const visited = new Set<number>();

  let current: Category | undefined = category;

  while (current) {
    if (visited.has(current.id)) {
      throw new Error("Circular category hierarchy detected.");
    }

    visited.add(current.id);
    segments.unshift(current.slug);

    if (current.parent_id === null) {
      break;
    }

    current = categories.find(
      item => item.id === current!.parent_id
    );

    if (!current) {
      throw new Error("Category parent not found.");
    }
  }

  return `/category/${segments.map(encodeURIComponent).join("/")}`;
}

/**
 * Resolves a hierarchical category path.
 *
 * Each slug must belong to the preceding parent.
 *
 * Returns null for invalid paths.
 */
export function resolveCategoryPath(
  path: string,
  categories: Category[]
): Category | null {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  let parentId: number | null = null;
  let current: Category | undefined;

  for (const segment of segments) {
    current = categories.find(
      category =>
        category.slug === segment &&
        category.parent_id === parentId
    );

    if (!current) {
      return null;
    }

    parentId = current.id;
  }

  return current ?? null;
}

/**
 * Returns the selected category and all its descendants.
 */
export function getCategoryDescendantIds(
  categoryId: number,
  categories: Category[]
): number[] {
  const ids: number[] = [];
  const visited = new Set<number>();
  const pending = [categoryId];

  while (pending.length > 0) {
    const currentId = pending.pop()!;

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    ids.push(currentId);

    const children = categories.filter(
      category => category.parent_id === currentId
    );

    pending.push(...children.map(child => child.id));
  }

  return ids;
}
