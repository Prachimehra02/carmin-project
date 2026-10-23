import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Copy, Check, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { copyToClipboard } from '../lib/couponUtils';
import { Coupon } from '../types/order';

const CATEGORIES: Record<string, string> = {
  'pots-planters': 'Pots & Planters',
  'vases': 'Vases',
  'sculptures': 'Sculptures',
  'artifacts': 'Artifacts',
  'decor-accessories': 'Decor Accessories',
  'wall-decor': 'Wall Decor',
  'mirrors': 'Mirrors',
  'new-arrival': 'New Arrivals',
};

interface Props {
  compact?: boolean;
}

export default function AvailableCoupons({ compact = false }: Props) {
  const { availableCoupons, total, setCouponCode, applyCoupon, couponCode } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (availableCoupons.length === 0) return null;

  const handleCopy = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleApply = async (code: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setCouponCode(code);
    // Wait for state to update, then apply
    setTimeout(() => applyCoupon(), 50);
  };

  const getCouponStatus = (coupon: Coupon): { canUse: boolean; reason: string | null } => {
    // Check minimum order
    if (coupon.minimum_order_amount > 0 && total < Number(coupon.minimum_order_amount)) {
      return { canUse: false, reason: `Minimum order ₹${Number(coupon.minimum_order_amount).toLocaleString()} required` };
    }
    // Check per-customer limit
    if (coupon.per_customer_usage_limit && coupon.user_used_count >= coupon.per_customer_usage_limit) {
      return { canUse: false, reason: 'You have already used this coupon' };
    }
    // First order check (only if user is logged in — if not logged in, we can't verify yet)
    if (coupon.first_order_only && user) {
      // We can't fully verify here without an RPC call, but user_used_count will be 0
      // The server will do the final check
    }
    // Total usage limit
    if (coupon.total_usage_limit && coupon.used_count >= coupon.total_usage_limit) {
      return { canUse: false, reason: 'This coupon has reached its usage limit' };
    }
    return { canUse: true, reason: null };
  };

  const formatDiscount = (c: Coupon) => {
    if (c.type === 'percentage') {
      const max = c.max_discount_amount > 0 ? ` up to ₹${Number(c.max_discount_amount).toLocaleString()}` : '';
      return `${c.value}% OFF${max}`;
    }
    return `₹${Number(c.value).toLocaleString()} OFF`;
  };

  const visibleCoupons = expanded ? availableCoupons : availableCoupons.slice(0, compact ? 2 : 3);

  return (
    <div className="border-t border-stone-200 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-sm font-medium text-stone-700 mb-3"
      >
        <span className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#960018]" />
          Available Coupons ({availableCoupons.length})
        </span>
        {availableCoupons.length > (compact ? 2 : 3) && (
          expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </button>

      <div className="space-y-2">
        {visibleCoupons.map((coupon) => {
          const status = getCouponStatus(coupon);
          const isApplied = couponCode.toUpperCase() === coupon.code.toUpperCase() && status.canUse;
          const isCopied = copiedCode === coupon.code;

          return (
            <div
              key={coupon.id}
              className={`border rounded-lg p-3 transition ${
                isApplied
                  ? 'border-[#960018] bg-[#960018]/5'
                  : status.canUse
                    ? 'border-stone-200 hover:border-[#960018]/40'
                    : 'border-stone-200 bg-stone-50/50 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-sm text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                      {coupon.code}
                    </span>
                    {isApplied && (
                      <span className="text-xs text-green-600 font-medium">Applied</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#960018]">{formatDiscount(coupon)}</p>
                  <div className="mt-1 space-y-0.5">
                    {coupon.minimum_order_amount > 0 && (
                      <p className="text-xs text-stone-500">
                        Min order ₹{Number(coupon.minimum_order_amount).toLocaleString()}
                      </p>
                    )}
                    {coupon.expiry_date && (
                      <p className="text-xs text-stone-500">
                        Valid until {new Date(coupon.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                    {coupon.first_order_only && (
                      <p className="text-xs text-stone-500">First order only</p>
                    )}
                    {coupon.applicable_scope === 'specific_categories' && coupon.applicable_categories.length > 0 && (
                      <p className="text-xs text-stone-500">
                        Valid for: {coupon.applicable_categories.map((c) => CATEGORIES[c] || c).join(', ')}
                      </p>
                    )}
                    {coupon.payment_restriction === 'prepaid' && (
                      <p className="text-xs text-stone-500">Prepaid orders only</p>
                    )}
                    {coupon.payment_restriction === 'cod' && (
                      <p className="text-xs text-stone-500">COD orders only</p>
                    )}
                    {status.reason && (
                      <p className="text-xs text-red-500 font-medium">{status.reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(coupon.code)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                      isCopied
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                  {status.canUse && !isApplied && (
                    <button
                      onClick={() => handleApply(coupon.code)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#960018] text-white hover:bg-[#6F0012] transition"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      Apply
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
