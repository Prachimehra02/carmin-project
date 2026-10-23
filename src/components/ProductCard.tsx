
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Product } from '../types/product';
import { useWishlist } from '../context/WishlistContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [currentImage, setCurrentImage] = useState(0);
  const { items, toggleWishlist } = useWishlist();

  const isWishlisted = items.some(item => item.id === product.id);

  // Safely handle products without an images array.
  const images = Array.isArray(product.images) ? product.images : [];
  const image = images[currentImage] || images[0];

  return (
    <div
      className="border border-gray-300 bg-white group cursor-pointer"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div
        className="relative aspect-square overflow-hidden bg-gray-100"
        onMouseEnter={() => {
          if (images.length > 1) {
            setCurrentImage(1);
          }
        }}
        onMouseLeave={() => setCurrentImage(0)}
      >
        <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 z-10">
          {image && (
            <img
              src={image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          )}

          {product.badge && (
            <div className="absolute top-2 left-0">
              <div
                className="bg-gradient-to-r from-[#5a000f] via-[#960018] to-[#c2182b] text-white text-xs font-semibold px-4 py-1 tracking-wide uppercase"
                style={{
                  clipPath:
                    'polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%)',
                }}
              >
                {product.badge}
              </div>
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product);
            }}
            className="absolute top-2 right-2"
            aria-label={
              isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'
            }
          >
            <Heart
              size={20}
              className={`transition-colors ${
                isWishlisted
                  ? 'fill-[#960018] text-[#960018]'
                  : 'text-gray-400'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="pt-2 pb-3 text-center">
        <h3 className="text-base text-[#393938] leading-snug font-medium">
          {product.name}
        </h3>

        <div className="mt-auto">
          {product.sale_price != null &&
          product.sale_price < product.price ? (
            <span className="text-sm tracking-wide">
              <span className="text-red-600 font-medium">
                ₹{product.sale_price.toLocaleString('en-IN')}
              </span>
              <span className="text-gray-400 line-through ml-1">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
            </span>
          ) : (
            <span className="text-[#6a6a6a] font-medium text-sm tracking-wide">
              ₹ {product.price.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {product.stock_quantity <= 0 && (
          <p className="text-xs text-red-500 font-medium mt-1">
            Out of Stock
          </p>
        )}
      </div>
    </div>
  );
}
