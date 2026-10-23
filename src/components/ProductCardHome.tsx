
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);

  const images = Array.isArray(product.images) ? product.images : [];
  const image = images[currentImage] || images[0];

  return (
    <div
      className="group cursor-pointer"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div
        className="relative aspect-square overflow-hidden bg-gray-100"
        onMouseEnter={() => {
          if (images.length > 1) setCurrentImage(1);
        }}
        onMouseLeave={() => setCurrentImage(0)}
      >
        {image && (
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute bottom-4 left-5">
          <p className="text-white/90 text-sm font-light tracking-wide mb-1">
            Latest in
          </p>
          <h3 className="text-white text-xl lg:text-2xl font-serif relative inline-block">
            {product.name}
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#960018] group-hover:w-full transition-all duration-500 ease-out" />
          </h3>
        </div>
      </div>
    </div>
  );
}
