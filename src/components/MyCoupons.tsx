import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Copy, Check, ShoppingBag, Clock, CheckCircle, AlertCircle, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCopyCoupon } from '../lib/couponUtils';
import { Coupon, CouponRedemption } from '../types/order';

type Tab = 'available' | 'used' | 'expired';

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

export default function MyCoupons() {
  const { user } = useAuth();
  const { copiedCode, copyCode, applyCoupon } = useCopyCoupon();
  const [tab, setTab] = useState<Tab>('available');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<Coupon[]>([]);
  const [used, setUsed] = useState<CouponRedemption[]>([]);
  const [expired, setExpired] = useState<Coupon[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Available coupons via RPC
      const { data: availData, error: availErr } = await supabase.rpc('get_available_coupons', {
        p_user_id: user.id,
      });
      if (availErr) throw availErr;
      setAvailable((availData || []) as Coupon[]);

      // Used coupons (redemptions with order info)
      const { data: usedData, error: usedErr } = await supabase
        .from('coupon_redemptions')
        .select(`
          *,
          order:orders ( order_number, created_at )
        `)
        .eq('user_id', user.id)
        .order('redeemed_at', { ascending: false });
      if (usedErr) throw usedErr;
      setUsed((usedData || []) as CouponRedemption[]);

      // Expired coupons — fetch all coupons and filter expired
      const { data: allCoupons, error: coupErr } = await supabase
        .from('coupons')
        .select('*')
        .order('expiry_date', { ascending: false });
      if (coupErr) throw coupErr;
      const expiredList = ((allCoupons || []) as Coupon[]).filter(
        (c) => c.expiry_date && new Date(c.expiry_date) < new Date()
      );
      setExpired(expiredList);
    } catch (err) {
      console.error('Error loading coupons:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDiscount = (c: Coupon) => {
    if (c.type === 'percentage') {
      const max = c.max_discount_amount > 0 ? ` up to ₹${Number(c.max_discount_amount).toLocaleString()}` : '';
      return `${c.value}% OFF${max}`;
    }
    return `₹${Number(c.value).toLocaleString()} OFF`;
  };

  const getEligibilityText = (c: Coupon): string[] => {
    const conditions: string[] = [];
    if (c.minimum_order_amount > 0) {
      conditions.push(`Minimum order ₹${Number(c.minimum_order_amount).toLocaleString()}`);
    }
    if (c.expiry_date) {
      conditions.push(`Valid until ${new Date(c.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
    }
    if (c.first_order_only) {
      conditions.push('First order only');
    }
    if (c.applicable_scope === 'specific_categories' && c.applicable_categories.length > 0) {
      const cats = c.applicable_categories.map((cat) => CATEGORIES[cat] || cat).join(', ');
      conditions.push(`Valid for: ${cats}`);
    }
    if (c.applicable_scope === 'specific_products') {
      conditions.push('Valid for specific products');
    }
    if (c.payment_restriction === 'prepaid') {
      conditions.push('Prepaid orders only');
    } else if (c.payment_restriction === 'cod') {
      conditions.push('COD orders only');
    }
    if (c.per_customer_usage_limit > 0) {
      conditions.push(`Limit: ${c.per_customer_usage_limit} per customer`);
    }
    return conditions;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-[#960018]" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'available', label: 'Available', icon: <Tag className="w-4 h-4" />, count: available.length },
    { key: 'used', label: 'Used', icon: <CheckCircle className="w-4 h-4" />, count: used.length },
    { key: 'expired', label: 'Expired', icon: <Clock className="w-4 h-4" />, count: expired.length },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <h2 className="text-2xl font-bold text-stone-900 mb-6">My Coupons</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition relative ${
              tab === t.key
                ? 'text-[#960018]'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                tab === t.key ? 'bg-[#960018]/10 text-[#960018]' : 'bg-stone-100 text-stone-500'
              }`}>
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#960018]" />
            )}
          </button>
        ))}
      </div>

      {/* Available */}
      {tab === 'available' && (
        <div>
          {available.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-600 mb-2">No coupons available right now</p>
              <p className="text-stone-400 text-sm">Check back later for new offers</p>
              <Link
                to="/products"
                className="inline-block mt-4 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {available.map((coupon) => {
                const conditions = getEligibilityText(coupon);
                const isCopied = copiedCode === coupon.code;
                return (
                  <div
                    key={coupon.id}
                    className="relative border-2 border-dashed border-[#960018] rounded-xl overflow-hidden bg-gradient-to-br from-[#FFF1F3] to-white hover:shadow-lg transition-all"
                  >
                    {/* Ticket notch */}
                    <div className="absolute top-1/2 -left-3 w-6 h-6 bg-white rounded-full border-2 border-[#E8A5AE] -translate-y-1/2" />
                    <div className="absolute top-1/2 -right-3 w-6 h-6 bg-white rounded-full border-2 border-[#E8A5AE] -translate-y-1/2" />

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-lg font-bold text-[#960018]">{formatDiscount(coupon)}</p>
                          {coupon.name && (
                            <p className="text-sm text-stone-600 mt-1">{coupon.name}</p>
                          )}
                        </div>
                        <span className="bg-[#960018] text-white text-xs px-2 py-1 rounded-full font-medium">
                          Available
                        </span>
                      </div>

                      {coupon.description && (
                        <p className="text-sm text-stone-600 mb-3">{coupon.description}</p>
                      )}

                      <div className="bg-stone-100 rounded-lg p-3 mb-3">
                        <p className="text-xs text-stone-500 mb-1">Code</p>
                        <p className="font-mono font-bold text-lg text-stone-900">{coupon.code}</p>
                      </div>

                      {conditions.length > 0 && (
                        <ul className="space-y-1 mb-4">
                          {conditions.map((cond, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-stone-600">
                              <span className="w-1 h-1 rounded-full bg-[#960018] mt-1.5 flex-shrink-0" />
                              {cond}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition flex-1 ${
                            isCopied
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {isCopied ? 'Copied!' : 'Copy Code'}
                        </button>
                        <button
                          onClick={() => applyCoupon(coupon.code, 'cart')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#960018] text-white hover:bg-[#6F0012] transition flex-1"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Used */}
      {tab === 'used' && (
        <div>
          {used.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-600">No coupons used yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {used.map((redemption) => (
                <div
                  key={redemption.id}
                  className="border border-stone-200 rounded-lg p-4 flex items-center justify-between bg-stone-50/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-stone-900">{redemption.coupon_code}</p>
                      <p className="text-sm text-stone-500">
                        Order: {redemption.order?.order_number || '—'}
                      </p>
                      <p className="text-xs text-stone-400">
                        {new Date(redemption.redeemed_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      −₹{Number(redemption.discount_amount).toLocaleString()}
                    </p>
                    <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      Used
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expired */}
      {tab === 'expired' && (
        <div>
          {expired.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-600">No expired coupons</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {expired.map((coupon) => (
                <div
                  key={coupon.id}
                  className="border border-stone-200 rounded-xl p-5 bg-stone-50/50 opacity-60"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-stone-500">{formatDiscount(coupon)}</p>
                      {coupon.name && <p className="text-sm text-stone-400 mt-1">{coupon.name}</p>}
                    </div>
                    <span className="bg-stone-200 text-stone-500 text-xs px-2 py-1 rounded-full">
                      Expired
                    </span>
                  </div>
                  <div className="bg-stone-100 rounded-lg p-3 mb-3">
                    <p className="font-mono font-bold text-stone-500">{coupon.code}</p>
                  </div>
                  {coupon.expiry_date && (
                    <p className="text-xs text-stone-400">
                      Expired on {new Date(coupon.expiry_date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
