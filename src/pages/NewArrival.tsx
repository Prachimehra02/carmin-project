import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import { Grid2x2 as Grid, List } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NewArrival() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

const { products, loading, error } = useProducts({
  newArrivals: true,
  activeOnly: true,
  sortBy: 'newest',
});

  return (
    <div className="pb-20">
      <div className="h-[calc(100vh-80px)] mb-4 bg-fixed bg-center bg-cover relative flex items-end"
  style={{ backgroundImage: `url(/Banner/new-arrivals-banner.jpeg)` }}>


        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex items-end justify-start pl-8 sm:pl-12 lg:pl-16 pb-20">
          <motion.h1
  initial={{ opacity: 0, y: 60 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8 }}
  className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white"
>
  New Arrivals
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
    <p className="text-gray-600 text-lg">
      New arrivals are coming soon.
    </p>
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
    </div>
  );
}
