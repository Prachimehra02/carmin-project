import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ChevronLeft, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Address } from '../types/order';
import AvailableCoupons from '../components/AvailableCoupons';
import AddressForm, { type AddressFormData } from '../components/AddressForm';

export default function Checkout() {
  const navigate = useNavigate();
  const {
  items,
  total,
  clearCart,
  discount,
  couponCode,
  setCouponCode,
  applyCoupon,
  removeCoupon,
  couponError,
  refreshCart,
  cartRefreshing,
  cartRefreshError,
} = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [priceReviewRequired, setPriceReviewRequired] = useState(false);
  const [error, setError] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressFormData>({
  full_name: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  district: '',
  state: '',
  state_code: '',
  country: 'India',
  pincode: '',
  landmark: '',
  address_type: 'Home',
  is_default: false,
});
  const [pincodeVerified, setPincodeVerified] = useState(false);
  const [taxRates, setTaxRates] = useState<Record<string, number>>({});
  const [taxRatesLoading, setTaxRatesLoading] = useState(true);

  const shippingCharge = total >= 500 ? 0 : 99;

  useEffect(() => {
  void refreshCart();
}, [refreshCart]);

  // Auto-apply pending coupon from popup/my-coupons
  // useEffect(() => {
  //   const pending = localStorage.getItem('pendingCouponApply');
  //   if (pending) {
  //     setCouponCode(pending);
  //     localStorage.removeItem('pendingCouponApply');
  //     setTimeout(() => applyCoupon(), 100);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
    if (user) fetchAddresses();
  }, [user]);

  useEffect(() => {
    fetchTaxRates();
  }, [items]);

  const fetchTaxRates = async () => {
  setTaxRatesLoading(true);

  try {
    if (items.length === 0) {
      setTaxRates({});
      return;
    }

    const ids = [...new Set(items.map((i) => i.id))];

    const { data, error: fetchError } = await supabase
      .from('products')
      .select(
        'id, sale_price, price, gst_percentage, hsn_code, hsn_master!products_hsn_id_fkey ( gst_percentage, cgst_percentage, sgst_percentage, igst_percentage, cess_percentage, hsn_code )'
      )
      .in('id', ids);

    if (fetchError) {
      throw fetchError;
    }

    if (!data || data.length !== ids.length) {
      throw new Error('Unable to load tax rates for all products.');
    }

    const map: Record<string, number> = {};

    for (const p of data) {
      const hsn = p.hsn_master as any;
      map[p.id] = p.gst_percentage ?? hsn?.gst_percentage ?? 0;
    }

    setTaxRates(map);
  } catch (err) {
    console.error('Failed to fetch tax rates:', err);
    setError('Unable to verify GST. Please refresh checkout and try again.');
  } finally {
    setTaxRatesLoading(false);
  }
};

  const displayTax = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = item.sale_price != null ? item.sale_price : item.price;
      const rate = taxRates[item.id] ?? 0;
      return sum + (price * item.quantity * rate) / 100;
    }, 0);
  }, [items, taxRates]);

  const grandTotal = total - discount + shippingCharge + displayTax;

  const fetchAddresses = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (data && data.length > 0) {
        setAddresses(data as Address[]);
        const defaultAddr = data.find((a: Address) => a.is_default);
        setSelectedAddressId(defaultAddr?.id || data[0].id);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    }
  };

  const handleSaveAddress = async () => {
  if (!user) return;

  setError('');

  try {
    if (!newAddress.full_name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const phone = newAddress.phone.replace(/\D/g, '');

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!newAddress.address_line_1.trim()) {
      setError('Please enter your address.');
      return;
    }

    if (!/^\d{6}$/.test(newAddress.pincode)) {
      setError('Please enter a valid 6-digit PIN code.');
      return;
    }

    if (!pincodeVerified) {
      setError('Please enter and verify a valid PIN code.');
      return;
    }

    if (!newAddress.city.trim()) {
      setError('Please enter your city.');
      return;
    }

    if (!newAddress.state || !newAddress.state_code) {
      setError('State could not be verified from the PIN code.');
      return;
    }

    const addrData = {
      user_id: user.id,
      full_name: newAddress.full_name.trim(),
      phone,
      address_line_1: newAddress.address_line_1.trim(),
      address_line_2: newAddress.address_line_2?.trim() || null,
      city: newAddress.city.trim(),
      district: newAddress.district?.trim() || null,
      state: newAddress.state.trim(),
      state_code: newAddress.state_code,
      country: 'India',
      pincode: newAddress.pincode,
      landmark: newAddress.landmark?.trim() || null,
      address_type: newAddress.address_type || 'Home',
      is_default: newAddress.is_default,
    };

    // If this address is being made default,
    // remove default status from existing addresses first.
    if (newAddress.is_default) {
      const { error: unsetError } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      if (unsetError) throw unsetError;
    }

    const { data, error: addrError } = await supabase
      .from('addresses')
      .insert([addrData])
      .select()
      .single();

    if (addrError) throw addrError;

    if (data) {
  const savedAddress = data as Address;

  await fetchAddresses();

  setSelectedAddressId(savedAddress.id);
  setShowNewAddress(false);

  setNewAddress({
    full_name: '',
    phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    district: '',
    state: '',
    state_code: '',
    country: 'India',
    pincode: '',
    landmark: '',
    address_type: 'Home',
    is_default: false,
  });

  setPincodeVerified(false);
  setError('');
}
  } catch (err) {
    console.error('Error saving address:', err);

    setError(
      err instanceof Error
        ? err.message
        : 'Failed to save address'
    );
  }
};

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <Link to="/cart" className="flex items-center gap-2 text-[#960018] hover:text-[#6F0012]">
              <ChevronLeft className="w-5 h-5" />
              Back to Cart
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-stone-600">No items in cart</p>
            <Link
              to="/products"
              className="inline-block mt-4 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user?.id) {
    throw new Error('User not authenticated');
  }
      const previousItems = items.map(item => ({ ...item }));

const refreshResult = await refreshCart();

if (!refreshResult.success) {
  throw new Error(
    'Unable to verify current product prices. Please try again.'
  );
}

const latestItems = refreshResult.items;

if (
  latestItems.some(
    item =>
      item.stock_quantity <= 0 ||
      item.quantity > item.stock_quantity
  )
) {
  throw new Error(
    'Some items are unavailable or have insufficient stock. Please review your cart.'
  );
}

const priceChanged = latestItems.some(item => {
  const previous = previousItems.find(
    oldItem => oldItem.variant_id === item.variant_id
  );

  if (!previous) return true;

  const previousPrice =
    previous.sale_price != null
      ? previous.sale_price
      : previous.price;

  const currentPrice =
    item.sale_price != null
      ? item.sale_price
      : item.price;

  return Number(previousPrice) !== Number(currentPrice);
});

if (priceChanged) {
  throw new Error(
    'One or more product prices have changed. Your cart has been updated. Please review the new total before placing your order.'
  );
}

  if (cartRefreshing) {
    throw new Error(
      'Your cart is being updated. Please wait and try again.'
    );
  }

  if (cartRefreshError) {
    throw new Error(
      'Unable to verify current prices. Please refresh your cart.'
    );
  }

      // ── Build shipping address ──
      let selectedAddress = addresses.find(
  (a) => a.id === selectedAddressId
);

if (!selectedAddress) {
  if (!newAddress.full_name.trim()) {
    throw new Error('Please enter your full name.');
  }

  const phone = newAddress.phone.replace(/\D/g, '');

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }

  if (!newAddress.address_line_1.trim()) {
    throw new Error('Please enter your address.');
  }

  if (!/^\d{6}$/.test(newAddress.pincode)) {
    throw new Error('Please enter a valid 6-digit PIN code.');
  }

  if (!pincodeVerified) {
    throw new Error('Please enter and verify a valid PIN code.');
  }

  if (!newAddress.city.trim()) {
    throw new Error('Please enter your city.');
  }

  if (!newAddress.state || !newAddress.state_code) {
    throw new Error('State could not be verified from the PIN code.');
  }

  const addressPayload = {
    user_id: user.id,
    full_name: newAddress.full_name.trim(),
    phone,
    address_line_1: newAddress.address_line_1.trim(),
    address_line_2: newAddress.address_line_2?.trim() || null,
    city: newAddress.city.trim(),
    district: newAddress.district?.trim() || null,
    state: newAddress.state.trim(),
    state_code: newAddress.state_code,
    country: 'India',
    pincode: newAddress.pincode,
    landmark: newAddress.landmark?.trim() || null,
    address_type: newAddress.address_type || 'Home',

    // First address automatically becomes default
    is_default: addresses.length === 0,
  };

  const { data: savedAddress, error: addressSaveError } =
    await supabase
      .from('addresses')
      .insert([addressPayload])
      .select()
      .single();

  if (addressSaveError) {
    throw new Error(
      `Unable to save shipping address: ${addressSaveError.message}`
    );
  }

  selectedAddress = savedAddress as Address;
}

      // If using new address (not saved), validate PIN was verified
      if (!selectedAddress) {
        throw new Error('Please select or enter a shipping address.');}
      
      const shippingAddress = selectedAddress;

      // ── Build cart items (only id + quantity — prices are never trusted) ──
      // Send as a parsed array, not a JSON string, so the jsonb parameter
      // receives a proper JSON array instead of a scalar text string.
      const cartItems = latestItems.map((item) => ({
  id: item.id,
  variant_id: item.variant_id,
  quantity: item.quantity,
}));

      // ── Call the atomic order-creation RPC ──
      // Everything happens in a single database transaction:
      //   stock validation, price/tax computation, coupon validation,
      //   order insert, order_items insert, stock decrement, coupon redemption.
      // If ANY step fails, the entire transaction rolls back — no partial order.
     // The amount displayed to the customer before checkout submission.
const expectedGrandTotal = Number(grandTotal.toFixed(2));

if (!Number.isFinite(expectedGrandTotal) || expectedGrandTotal < 0) {
  throw new Error(
    'Unable to verify your order total. Please refresh checkout.'
  );
}

const { data: rpcResult, error: rpcError } = await supabase.rpc(
  'create_order_atomic',
  {
    p_user_id: user.id,
    p_cart_items: cartItems,
    p_shipping_address: shippingAddress,
    p_shipping_charge: shippingCharge,
    p_payment_method: 'COD',
    p_coupon_code: couponCode.trim() || null,
    p_expected_grand_total: expectedGrandTotal,
  }
);

      if (rpcError) {
        // The RPC raised an exception — the entire transaction was rolled back.
        // No order, no order_items, no stock changes, no coupon usage.
        // Map technical errors to friendly messages; business-rule errors
        // from RAISE EXCEPTION are already customer-friendly.
        const msg = rpcError.message || '';
        if (msg.includes('array length of a scalar') || msg.includes('invalid input syntax for type jsonb')) {
          throw new Error('There was a problem with your cart. Please refresh the page and try again.');
        }
        if (msg.includes('P0001') || msg.includes('configuration error') || msg.includes('contact support')) {
          throw new Error(msg.replace(/^ERROR:\s*/i, '').replace(/^P0001:\s*/i, ''));
        }
        throw new Error(msg || 'Failed to create order. Please try again.');
      }

      const result = rpcResult?.[0];
      if (!result || !result.success) {
        throw new Error(result?.error_message || 'Failed to create order. Please try again.');
      }

      const orderId = result.order_id as string;
      const orderNumber = result.order_number as string;
      const finalDiscount = Number(result.discount);
      const finalGrandTotal = Number(result.grand_total);
      const rpcItems = ((result.items as any[]) || []).filter(
        (vi: any) => vi && typeof vi === 'object' && vi.id
      ) as Array<{
        id: string; variant_id: string; name: string; sku: string; quantity: number;
        unitPrice: number; lineSubtotal: number; lineTax: number;
      }>;

      // ── Send confirmation emails (non-blocking) ──
      const subtotal = rpcItems.reduce((sum, vi) => sum + vi.lineSubtotal, 0);
      const totalTax = rpcItems.reduce((sum, vi) => sum + vi.lineTax, 0);
      const emailData = {
        orderId: orderNumber,
        customerEmail: user.email,
        customerName: (shippingAddress as any).full_name,
        items: rpcItems.map((vi) => ({
          name: vi.name,
          quantity: vi.quantity,
          price: vi.unitPrice,
          image: items.find((i) => i.variant_id === vi.variant_id)?.image || '',
        })),
        subtotal,
        discount: finalDiscount,
        shippingCharge,
        taxAmount: totalTax,
        grandTotal: finalGrandTotal,
        shippingAddress,
        couponCode: finalDiscount > 0 ? couponCode.trim().toUpperCase() : undefined,
        orderDate: new Date().toISOString(),
      };

      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(emailData),
      }).catch((err) => {
        console.error('Email send error (non-blocking):', err);
      });

      // ── Clear cart and navigate to confirmation ──
      clearCart();
      navigate('/order-confirmation', {
        state: {
          order: {
            id: orderId,
            order_number: orderNumber,
            discount: finalDiscount,
            grand_total: finalGrandTotal,
            subtotal,
            shipping_charge: shippingCharge,
            tax_amount: totalTax,
            payment_method: 'COD',
            shipping_address: shippingAddress,
            coupon_code: finalDiscount > 0 ? couponCode.trim().toUpperCase() : null,
          },
        },
      });

    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-4 px-4 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Link to="/cart" className="flex items-center gap-2 text-[#960018] hover:text-[#6F0012]">
            <ChevronLeft className="w-5 h-5" />
            Back to Cart
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-stone-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-4">Shipping Address</h2>

                {addresses.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition ${
                          selectedAddressId === addr.id
                            ? 'border-[#960018] bg-[#960018]/5'
                            : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          value={addr.id}
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-semibold text-stone-900">{addr.full_name}</p>
                          <p className="text-sm text-stone-600">{addr.phone}</p>
                          <p className="text-sm text-stone-600">
                            {addr.address_line_1}
                            {addr.address_line_2 ? `, ${addr.address_line_2}` : ''}
                          </p>
                          <p className="text-sm text-stone-600">
                            {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                          {addr.is_default && (
                            <span className="inline-block mt-1 text-xs bg-[#960018]/10 text-[#960018] px-2 py-0.5 rounded">Default</span>
                          )}
                        </div>
                      </label>
                    ))}
                    <button
  type="button"
  onClick={() => {
    if (showNewAddress) {
      setShowNewAddress(false);

      const defaultAddress =
        addresses.find((address) => address.is_default) || addresses[0];

      setSelectedAddressId(defaultAddress?.id || '');
    } else {
      setShowNewAddress(true);
      setSelectedAddressId('');
      setPincodeVerified(false);

      setNewAddress({
        full_name: '',
        phone: '',
        address_line_1: '',
        address_line_2: '',
        city: '',
        district: '',
        state: '',
        state_code: '',
        country: 'India',
        pincode: '',
        landmark: '',
        address_type: 'Home',
        is_default: false,
      });
    }
  }}
  className="text-[#960018] hover:text-[#6F0012] font-medium text-sm"
>
  {showNewAddress ? 'Cancel' : '+ Add new address'}
</button>
                  </div>
                )}

                {(addresses.length === 0 || showNewAddress) && (
  <div className="space-y-4">
    <AddressForm
      value={newAddress}
      onChange={setNewAddress}
      showLabel={true}
      showDefault={addresses.length > 0}
      onPincodeVerifiedChange={setPincodeVerified}
    />

    {showNewAddress && addresses.length > 0 && (
      <button
        type="button"
        onClick={handleSaveAddress}
        className="bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
      >
        Save Address
      </button>
    )}
  </div>
)}
              </div>

              {/* Payment Information */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-4">Payment Information</h2>
                <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-600">
                  <p>Payment processing will be integrated via Stripe or Razorpay.</p>
                  <p className="mt-1">For now, orders will be marked as paid upon submission.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading ||
  taxRatesLoading ||
  cartRefreshing ||
  items.some((item) => taxRates[item.id] === undefined)}
                className="w-full bg-[#960018] hover:bg-[#6F0012] disabled:bg-stone-400 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Processing...' : `Place Order - ₹${grandTotal.toLocaleString()}`}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-24 space-y-4">
              <h2 className="text-xl font-bold text-stone-900 mb-6">Order Summary</h2>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {items.map((item) => {
  const price =
    item.sale_price != null ? item.sale_price : item.price;

  return (
    <div
      key={item.variant_id}
      className="flex justify-between gap-4 text-sm text-stone-600"
    >
      <div>
        <p>{item.name} × {item.quantity}</p>

        {item.variant_attributes?.length > 0 && (
          <p className="text-xs text-stone-500 mt-1">
            {item.variant_attributes
              .map(attribute =>
                `${attribute.name}: ${attribute.value}`
              )
              .join(' • ')}
          </p>
        )}
      </div>

      <span className="whitespace-nowrap">
        ₹{(price * item.quantity).toLocaleString()}
      </span>
    </div>
  );
})}
              </div>

              {/* Coupon Code */}
              <div className="border-t border-stone-200 pt-4">
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
                      type="button"
                      onClick={removeCoupon}
                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100 transition"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyCoupon}
                      className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm hover:bg-stone-800 transition"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
                {/* {discount > 0 && !couponError && (
                  <p className="mt-1 text-xs text-green-600 font-medium">Coupon applied — you saved ₹{discount.toLocaleString()}!</p>
                )} */}
              </div>

              {/* Available Coupons */}
              {/* <AvailableCoupons compact /> */}

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
                {displayTax > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Taxes (GST):</span>
                    <span>₹{displayTax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-stone-900 border-t border-stone-200 pt-2">
                  <span>Total:</span>
                  <span className="text-[#960018]">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
