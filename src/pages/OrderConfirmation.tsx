import { CheckCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function OrderConfirmation() {
  const location = useLocation();
  const order = location.state?.order;

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-24 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-lg shadow-lg p-12">
            <p className="text-stone-600 mb-4">Order not found</p>
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
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse"></div>
              <CheckCircle className="w-20 h-20 text-green-600 relative" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-stone-900 mb-2">Order Confirmed!</h1>
          <p className="text-stone-600 mb-8">Thank you for your purchase. Your order has been received.</p>

          <div className="bg-stone-50 rounded-lg p-6 mb-8 text-left space-y-4">
            <div>
              <p className="text-sm text-stone-600">Order ID</p>
              <p className="font-mono font-semibold text-stone-900">{order.order_number}</p>
            </div>

            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm text-stone-600 mb-2">Order Summary</p>
              <div className="space-y-2">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm text-stone-700">
                    <span>{item.product_name || item.name} x {item.quantity}</span>
                    <span>₹{((item.line_total ? Number(item.line_total) : item.price * item.quantity)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-200 pt-4 space-y-1">
              <div className="flex justify-between text-sm text-stone-600">
                <span>Subtotal</span>
                <span>₹{(order.subtotal || 0).toLocaleString()}</span>
              </div>
              {(order.discount || 0) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-₹{order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-stone-600">
                <span>Shipping</span>
                <span>{(order.shipping_charge || 0) === 0 ? 'Free' : `₹${order.shipping_charge}`}</span>
              </div>
              {(order.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-stone-600">
                  <span>Taxes</span>
                  <span>₹{Number(order.tax_amount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-stone-900 pt-1">
                <span>Total</span>
                <span className="text-[#960018]">₹{(order.grand_total || 0).toLocaleString()}</span>
              </div>
            </div>

            {order.coupon_code && (
              <div className="border-t border-stone-200 pt-4">
                <p className="text-sm text-stone-600">Coupon Applied</p>
                <p className="font-semibold text-[#960018]">{order.coupon_code}</p>
              </div>
            )}
          </div>

          <p className="text-stone-600 text-sm mb-8">
            We'll send you an email with tracking information shortly. You can check your order status in your account.
          </p>

          <div className="space-y-3">
            <Link
              to="/products"
              className="block w-full bg-[#960018] hover:bg-[#6F0012] text-white font-semibold py-3 rounded-lg transition-colors text-center"
            >
              Continue Shopping
            </Link>
            <Link
              to="/"
              className="block w-full border border-stone-300 hover:bg-stone-50 text-stone-900 font-semibold py-3 rounded-lg transition-colors text-center"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
