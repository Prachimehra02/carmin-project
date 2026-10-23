import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../types/product';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'newest';
  featured?: boolean;
  activeOnly?: boolean;
  limit?: number;
  categoryId?: number;
  categoryIds?: number[];
  collectionIds?: number[];
  attributes?: Record<number, number[]>;
  newArrivals?: boolean;
}

export function useProducts(filters: ProductFilters = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categoryIdsKey = JSON.stringify(filters.categoryIds || []);
  const collectionIdsKey = JSON.stringify(filters.collectionIds || []);
  const attributesKey = JSON.stringify(filters.attributes || {});

  useEffect(() => {
  fetchProducts();
}, [
  filters.category,
  filters.categoryId,
  categoryIdsKey,
  collectionIdsKey,
  attributesKey,
  filters.minPrice,
  filters.maxPrice,
  filters.search,
  filters.sortBy,
  filters.featured,
  filters.activeOnly,
  filters.limit,
    filters.newArrivals,
]);

  async function fetchProducts() {
    try {
      setLoading(true);
      setError(null);

      const hasDynamicFilters =
        filters.categoryId !== undefined ||
        (filters.categoryIds?.length ?? 0) > 0 ||
  (filters.collectionIds?.length ?? 0) > 0 ||
  Object.values(filters.attributes || {}).some(ids => ids.length > 0);

let query;

if (hasDynamicFilters) {
  query = supabase
    .rpc('filter_storefront_products', {
      p_category_id: filters.categoryId ?? null,
      p_collection_ids: filters.collectionIds ?? [],
      p_attributes: filters.attributes ?? {},
    })
    .select('*');
} else {
  query = supabase.from('products').select('*');
}
      if (filters.categoryIds !== undefined) {
        if (filters.categoryIds.length === 0) {
          setProducts([]);
          return;
          }
         query = query.in('category_id', filters.categoryIds);
        }

      if (filters.activeOnly !== false) {
        query = query.eq('is_active', true);
      }

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.featured) {
        query = query.eq('featured', true);
      }

      if (filters.newArrivals) {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Check how many active products were added in the last 60 days.
  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .gte('created_at', sixtyDaysAgo.toISOString());

  if (countError) throw countError;

  // If fewer than 12 products are new, include older products
  // by selecting the 12 most recently added active products.
  if ((count ?? 0) >= 12) {
    query = query.gte('created_at', sixtyDaysAgo.toISOString());
  } else {
    query = query.limit(12);
  }
}

      if (filters.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      switch (filters.sortBy) {
        case 'price-asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price-desc':
          query = query.order('price', { ascending: false });
          break;
        case 'name-asc':
          query = query.order('name', { ascending: true });
          break;
        case 'name-desc':
          query = query.order('name', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      if (filters.limit !== undefined) {query = query.limit(filters.limit); }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }

  return { products, loading, error, refetch: fetchProducts };
}
