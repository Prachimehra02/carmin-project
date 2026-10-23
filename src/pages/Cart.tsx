import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, ChevronLeft, AlertCircle, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useEffect } from 'react';
import AvailableCoupons from '../components/AvailableCoupons';

export default function Cart() {
  const { items, total, removeFromCart, updateQuantity, discount, couponCode, setCouponCode, applyCoupon, removeCoupon, couponError } = useCart();

  const shippingCharge = total >= 500 ? 0 : 99;
  const grandTotal = total - discount + shippingCharge;

  // Auto-apply pending coupon from popup/my-coupons
  useEffect(() => {
    const pending = localStorage.getItem('pendingCouponApply');
    if (pending) {
      setCouponCode(pending);
      localStorage.removeItem('pendingCouponApply');
      setTimeout(() => applyCoupon(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <ShoppingBag className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-stone-900 mb-2">Your Cart is Empty</h1>
            <p className="text-stone-600 mb-6">Add some beautiful items to get started</p>
            <Link
              to="/products"
              className="inline-block bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Continue Shopping
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
          <Link to="/products" className="flex items-center gap-2 text-[#960018] hover:text-[6F0012]">
            <ChevronLeft className="w-5 h-5" />
            Continue Shopping
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-stone-900 mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const price = item.sale_price != null ? item.sale_price : item.price;
              const isLowStock = item.stock_quantity != null && item.stock_quantity <= 5 && item.stock_quantity > 0;
              const isOutOfStock = item.stock_quantity != null && item.stock_quantity === 0;

              return (
                <div key={item.variant_id} className="bg-white rounded-lg shadow p-6 flex gap-6">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-32 h-32 object-cover rounded-lg"
                  />

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-stone-900 mb-2">{item.name}</h3>
                    {item.variant_attributes && item.variant_attributes.length > 0 && (
  <p className="text-sm text-stone-500 mb-2">
    {item.variant_attributes
      .map(attribute => `${attribute.name}: ${attribute.value}`)
      .join(' | ')}
  </p>
)}
                    <div className="mb-4">
                      {item.sale_price != null && item.sale_price < item.price ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[#960018] font-semibold text-lg">₹{item.sale_price.toLocaleString()}</span>
                          <span className="text-stone-400 line-through text-sm">₹{item.price.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-[#960018] font-semibold text-lg">₹{item.price.toLocaleString()}</span>
                      )}
                    </div>

                    {isOutOfStock && (
                      <div className="flex items-center gap-2 mb-2 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>Out of stock</span>
                      </div>
                    )}
                    {isLowStock && (
                      <div className="flex items-center gap-2 mb-2 text-orange-600 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>Only {item.stock_quantity} left</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.variant_id, Math.max(1, item.quantity - 1))}
                          className="px-3 py-2 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors font-semibold"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-bold text-stone-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-3 py-2 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors font-semibold"
                        >
                          +
                        </button>
                      </div>

                      <p className="ml-auto font-bold text-stone-900">
                        ₹{(price * item.quantity).toLocaleString()}
                      </p>

                      <button
                        onClick={() => removeFromCart(item.variant_id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24 space-y-4">
              <h2 className="text-xl font-bold text-stone-900 mb-6">Order Summary</h2>

              {/* Coupon Code Input */}
              <div>
                <p className="text-sm font-medium text-stone-900 mb-2">Have a coupon?</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="w-full pl-9 pr-4 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-[#960018]"
                    />
                  </div>
                  {discount > 0 ? (
                    <button
                      onClick={removeCoupon}
                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100 transition"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={applyCoupon}
                      className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm hover:bg-stone-800 transition"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
                {discount > 0 && !couponError && (
                  <p className="mt-1 text-xs text-green-600 font-medium">Coupon applied — you saved ₹{discount.toLocaleString()}!</p>
                )}
              </div>

              {/* Available Coupons */}
              <AvailableCoupons compact />

              <div className="border-t border-stone-200 pt-4 space-y-2">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon Discount:</span>
                    <span>-₹{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-600">
                  <span>Shipping:</span>
                  <span>{shippingCharge === 0 ? 'Free' : `₹${shippingCharge}`}</span>
                </div>
                <div className="border-t border-stone-200 pt-2 flex justify-between text-lg font-bold text-stone-900">
                  <span>Total:</span>
                  <span className="text-[#960018]">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <Link
                to="/checkout"
                className="block w-full bg-[#960018] hover:bg-[#6F0012] text-white font-semibold py-3 rounded-lg text-center transition-colors"
              >
                Proceed to Checkout
              </Link>

              <Link
                to="/products"
                className="block w-full border border-stone-300 hover:bg-stone-50 text-stone-900 font-semibold py-3 rounded-lg text-center transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
