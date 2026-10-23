import { Product } from '../types/product';
import ProductCard from './ProductCard';

interface ProductsPageGridProps {
  title: string;
  products: Product[];
  id?: string;
  bannerImage?: string;
}

export default function ProductsPageGrid({ title, products, id, bannerImage }: ProductsPageGridProps) {
  return (
    <section id={id} className="py-12">
      {bannerImage && (
        <div className="relative h-48 sm:h-64 lg:h-80 mb-12 overflow-hidden">
          <img
            src={bannerImage}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex items-center justify-start pl-8 sm:pl-12 lg:pl-16">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white">
              {title}
            </h2>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!bannerImage && (
          <h2 className="text-3xl lg:text-4xl font-bold text-[#2B1F3D] mb-8 text-center">
            {title}
          </h2> 
        )}

        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-2">
            <button className="p-2 border border-gray-300 rounded hover:bg-gray-100 transition">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
              </svg>
            </button>
            <button className="p-2 border border-gray-300 rounded hover:bg-gray-100 transition">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
              </svg>
            </button>
          </div>
          <div className="flex gap-4">
            <select className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition">
              <option>SORT</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newest</option>
            </select>
            <button className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 transition">
              FILTER
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
