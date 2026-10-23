import { Product } from '../types/product';
import ProductCardHome from './ProductCardHome';

interface ProductGridProps {
  title: string;
  products: Product[];
  id?: string;
}

export default function ProductGrid({ title, products, id }: ProductGridProps) {
  return (
    <section id={id} className="pb-8 pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
    <div className="flex items-center justify-center gap-4 mb-2">
           <span className="w-8 h-px bg-[#960018]/30" />
           <span className="text-[10px] sm:text-xs tracking-[0.28em] uppercase text-[#960018]">Introducing</span>
           <span className="w-8 h-px bg-[#960018]/30" />
         </div>

    {/* Main heading */}
    <h2 className="font-[Manrope] text-center text-3xl sm:text-4xl lg:text-[2.5rem] font-normal leading-[1.1] tracking-[-0.025em] text-[#2B2B2B] mb-6">
      The Carmin Selection
    </h2>
        
        <h2 className="text-3xl lg:text-4xl font-bold text-[#2B1F3D] mb-2 text-center">
          {title}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8">
          {products.map((product) => (
            <ProductCardHome key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
