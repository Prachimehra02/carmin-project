
import { X, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
}: CartDrawerProps) {
  const {
    items,
    total,
    removeFromCart,
    updateQuantity,
  } = useCart();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-[#960018]" />
            <h2 className="text-xl font-bold text-stone-900">
              Shopping Cart
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Close cart"
            className="p-1 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="w-16 h-16 text-stone-300 mb-4" />
              <p className="text-stone-600">
                Your cart is empty
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const price =
                  item.sale_price != null
                    ? item.sale_price
                    : item.price;

                const isOutOfStock =
                  item.stock_quantity === 0;

                const maxReached =
                  item.stock_quantity != null &&
                  item.quantity >= item.stock_quantity;

                return (
                  <div
                    key={item.variant_id}
                    className="flex gap-4 p-4 bg-stone-50 rounded-lg"
                  >
                    <Link
                      to={`/products/${item.id}`}
                      onClick={onClose}
                      className="shrink-0"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/products/${item.id}`}
                        onClick={onClose}
                      >
                        <h3 className="font-semibold text-stone-900 text-sm mb-1 hover:text-[#960018]">
                          {item.name}
                        </h3>
                      </Link>

                      {/* Variant Attributes */}
                      {item.variant_attributes &&
                        item.variant_attributes.length > 0 && (
                          <p className="text-xs text-stone-500 mb-2">
                            {item.variant_attributes
                              .map(
                                (attribute) =>
                                  `${attribute.name}: ${attribute.value}`
                              )
                              .join(' | ')}
                          </p>
                        )}

                      {/* Price */}
                      <div className="mb-3">
                        <span className="text-[#960018] font-semibold text-sm">
                          ₹{price.toLocaleString()}
                        </span>

                        {item.sale_price != null &&
                          item.sale_price < item.price && (
                            <span className="ml-2 text-xs text-stone-400 line-through">
                              ₹{item.price.toLocaleString()}
                            </span>
                          )}
                      </div>

                      {/* Stock Warning */}
                      {isOutOfStock && (
                        <p className="text-xs text-red-600 mb-2">
                          Out of stock
                        </p>
                      )}

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.variant_id,
                              Math.max(1, item.quantity - 1)
                            )
                          }
                          disabled={isOutOfStock}
                          aria-label="Decrease quantity"
                          className="px-2 py-1 border border-stone-300 rounded text-sm hover:bg-stone-100 disabled:opacity-40"
                        >
                          -
                        </button>

                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() =>
                            updateQuantity(
                              item.variant_id,
                              item.quantity + 1
                            )
                          }
                          disabled={isOutOfStock || maxReached}
                          aria-label="Increase quantity"
                          className="px-2 py-1 border border-stone-300 rounded text-sm hover:bg-stone-100 disabled:opacity-40"
                        >
                          +
                        </button>

                        <button
                          onClick={() =>
                            removeFromCart(item.variant_id)
                          }
                          aria-label="Remove item"
                          className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-stone-200 p-6 space-y-4 shrink-0">
            <div className="flex justify-between items-center text-lg font-bold">
              <span className="text-stone-900">Subtotal:</span>
              <span className="text-[#960018]">
                ₹{total.toLocaleString()}
              </span>
            </div>

            <Link
              to="/checkout"
              onClick={onClose}
              className="block w-full bg-[#960018] hover:bg-[#6F0012] text-white font-semibold py-3 rounded-lg text-center transition-colors"
            >
              Proceed to Checkout
            </Link>

            <Link
              to="/cart"
              onClick={onClose}
              className="block w-full border border-stone-300 hover:bg-stone-50 text-stone-900 font-semibold py-3 rounded-lg text-center transition-colors"
            >
              View Cart
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
