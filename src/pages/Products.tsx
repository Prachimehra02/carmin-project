import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import FilterSidebar, { FilterOptions } from '../components/FilterSidebar';
import { Filter, Grid2x2 as Grid, List } from 'lucide-react';
import { motion } from "framer-motion";

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterOptions>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'newest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  const { products, loading, error } = useProducts({ ...filters, search: searchQuery, sortBy });

  const handleApplyFilters = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const getCategoryTitle = () => {
    if (searchQuery) return `Search Results for "${searchQuery}"`;
    if (filters.category === 'pots-planters') return 'Pots & Planters';
    if (filters.category === 'vases') return 'Vases';
    return 'All Products';
  };

  const getBannerImage = () => {
    if (filters.category === 'pots-planters') return '/Banner/Planters-banner.jpeg';
    if (filters.category === 'vases') return '/Banner/vase-banner.jpeg';
    return '/Banner/shop-all-banner.jpeg';
  };

  return (
    <div className="pb-20">
      <div className="h-[calc(100vh-80px)] mb-4 bg-fixed bg-center bg-cover relative flex items-end"
  style={{ backgroundImage: `url(${getBannerImage()})` }}>

      
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-end justify-start pl-8 sm:pl-12 lg:pl-16 pb-20">
          <motion.h1
  initial={{ opacity: 0, y: 60 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8 }}
  className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white"
>
  {getCategoryTitle()}
</motion.h1>
        </div>
      </div>


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
              {(
  (filters.categoryId !== undefined ? 1 : 0) +
  (filters.collectionIds?.length ?? 0) +
  Object.values(filters.attributes || {}).reduce(
    (total, ids) => total + ids.length,
    0
  )
) > 0 && (
  <span className="bg-[#960018] text-white text-xs px-2 py-0.5 rounded-full">
    {(
      (filters.categoryId !== undefined ? 1 : 0) +
      (filters.collectionIds?.length ?? 0) +
      Object.values(filters.attributes || {}).reduce(
        (total, ids) => total + ids.length,
        0
      )
    )}
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
