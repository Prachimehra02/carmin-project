import { Link } from 'react-router-dom';
import { Heart, Trash2, ChevronLeft, ShoppingCart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

export default function Wishlist() {
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleAddToCart = (product: typeof items[0]) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images[0],
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <Link to="/products" className="flex items-center gap-2 text-[#960018] hover:text-[#6F0012]">
              <ChevronLeft className="w-5 h-5" />
              Continue Shopping
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Heart className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-stone-900 mb-2">Your Wishlist is Empty</h1>
            <p className="text-stone-600 mb-6">Save your favorite items to view later</p>
            <Link
              to="/products"
              className="inline-block bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Explore Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-4 px-4 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Link to="/products" className="flex items-center gap-2 text-[#960018] hover:text-[#6F0012]">
            <ChevronLeft className="w-5 h-5" />
            Continue Shopping
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-stone-900 mb-2">My Wishlist</h1>
        <p className="text-stone-600 mb-8">{items.length} item(s) saved</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="relative h-64 overflow-hidden bg-stone-100">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                />
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors"
                >
                  <Heart className="w-5 h-5 text-red-600 fill-red-600" />
                </button>
              </div>

              <div className="p-6">
                <Link
                  to={`/product/${product.id}`}
                  className="text-lg font-bold text-stone-900 hover:text-[#960018] transition-colors mb-2 block"
                >
                  {product.name}
                </Link>

                <p className="text-stone-600 text-sm mb-4 line-clamp-2">{product.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#960018]">
                    ₹{product.price.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => handleAddToCart(product)}
                  className="w-full mt-4 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
