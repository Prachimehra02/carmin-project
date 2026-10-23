import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getActiveCategories,
  getCategoryDescendantIds,
  getCategoryUrl,
  resolveCategoryPath,
  type Category,
} from '../services/categoryService';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import FilterSidebar, { FilterOptions } from '../components/FilterSidebar';
import { Filter, Grid2x2 as Grid, List } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORY_BANNERS: Record<string, string> = {
  'home-decor': '/Banner/decor-banner.jpeg',
  'vases': '/Banner/vase-banner.jpeg',
  'pots-planters': '/Banner/Planters-banner.jpeg',
};

const DEFAULT_CATEGORY_BANNER = '/carousel2.jpg';


export default function CategoryPage() {
  const { '*': categoryPath } = useParams<{ '*': string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterOptions>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'newest'
  >('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        setCategoriesLoading(true);
        setCategoriesError(null);

        const data = await getActiveCategories();

        if (!cancelled) {
          setCategories(data);
        }
      } catch (err) {
        if (!cancelled) {
          setCategoriesError(
            err instanceof Error ? err.message : 'Unable to load categories'
          );
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  // Resolve the full hierarchy, not just the last slug.
  const category = categoriesLoading
    ? null
    : resolveCategoryPath(categoryPath || '', categories);

  // Include the selected category and all its descendants.
  const categoryIds = category
    ? getCategoryDescendantIds(category.id, categories)
    : [];

  // Build breadcrumbs from the category's parent relationships.
  const breadcrumbs: Category[] = [];

  if (category) {
    const visited = new Set<number>();
    let current: Category | undefined = category;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      breadcrumbs.unshift(current);

      current =
        current.parent_id === null
          ? undefined
          : categories.find(item => item.id === current!.parent_id);
    }
  }

  const bannerImage = category
    ? CATEGORY_BANNERS[category.slug] || DEFAULT_CATEGORY_BANNER
    : DEFAULT_CATEGORY_BANNER;

  const { products, loading, error } = useProducts({
    ...filters,
    categoryIds,
    search: searchQuery,
    sortBy,
  });

  const handleApplyFilters = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  // Do not render the product listing until the category is resolved.
  if (categoriesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-600">Loading category...</p>
      </div>
    );
  }

  if (categoriesError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-red-600">{categoriesError}</p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-serif text-[#2B1F3D]">
          Category not found
        </h1>
        <Link to="/products" className="text-[#960018] hover:underline">
          Browse all products
        </Link>
      </div>
    );
  }

  // Keep your existing return JSX below.


  return (
    <div className="pb-20">
      <div className="h-[calc(100vh-80px)] mb-4 bg-fixed bg-center bg-cover relative flex items-end"
  style={{ backgroundImage: `url(${bannerImage})` }}>


        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-end justify-start pl-8 sm:pl-12 lg:pl-16 pb-20">
          <motion.h1
  initial={{ opacity: 0, y: 60 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8 }}
  className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white"
>
  {category.name}
</motion.h1>
        </div>
      </div>

      {/* Breadcrumb */}
<nav
  aria-label="Category breadcrumb"
  className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6"
>
  <div className="flex flex-wrap items-center gap-2 text-sm">
    <Link to="/" className="text-gray-500 hover:text-[#960018]">
      Home
    </Link>

    {breadcrumbs.map((item, index) => {
      const isLast = index === breadcrumbs.length - 1;

      return (
        <span key={item.id} className="flex items-center gap-2">
          <span className="text-gray-400">/</span>

          {isLast ? (
            <span className="font-medium text-[#2B1F3D]">
              {item.name}
            </span>
          ) : (
            <Link
              to={getCategoryUrl(item, categories)}
              className="text-gray-500 hover:text-[#960018]"
            >
              {item.name}
            </Link>
          )}
        </span>
      );
    })}
  </div>
</nav>



      <div className="pt-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 border rounded transition ${
                viewMode === 'grid'
                  ? 'bg-[#2B1F3D] text-white border-[#2B1F3D]'
                  : 'border-gray-300 hover:bg-gray-100'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 border rounded transition ${
                viewMode === 'list'
                  ? 'bg-[#2B1F3D] text-white border-[#2B1F3D]'
                  : 'border-gray-300 hover:bg-gray-100'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-4 w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition focus:outline-none focus:border-[#960018]"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
            <button
              onClick={() => setIsFilterOpen(true)}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span>FILTER</span>
              {((filters.collectionIds?.length ?? 0) > 0 || 
                Object.values(filters.attributes || {}).some(ids => ids.length > 0)) && (
                <span className="bg-[#960018] text-white text-xs px-2 py-0.5 rounded-full">
                  {Object.keys(filters).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#960018]" />
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg">No products found matching your criteria.</p>
            <button
              onClick={() => {
                setFilters({});
                setSortBy('newest');
                setSearchQuery('');
                setSearchParams({});
              }}
              className="mt-4 px-6 py-2 bg-[#2B1F3D] text-white rounded-lg hover:bg-[#960018] transition"
            >
              Clear Filters
            </button>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div
  className={
    viewMode === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 gap-6'
  }
>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="mt-8 text-center text-gray-600">
            Showing {products.length} {products.length === 1 ? 'product' : 'products'}
          </div>
        )}
      </div>

      <FilterSidebar
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  );
}
