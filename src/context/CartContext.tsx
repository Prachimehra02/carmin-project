import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { CartItem } from '../types/cart';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Coupon, CouponValidationResult } from '../types/order';

interface AvailableCoupon extends Coupon {
  used_count: number;
  user_used_count: number;
}

interface CartRefreshResult {
  success: boolean;
  items: CartItem[];
}

interface CartContextType {
  items: CartItem[];
  total: number;
  refreshCart: () => Promise<CartRefreshResult>;
  cartRefreshing: boolean;
  cartRefreshError: string | null;
  addToCart: (item: CartItem) => void;
  removeFromCart: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  couponCode: string;
  setCouponCode: (code: string) => void;
  discount: number;
  applyCoupon: () => Promise<boolean>;
  removeCoupon: () => void;
  couponError: string | null;
  availableCoupons: AvailableCoupon[];
  fetchAvailableCoupons: () => Promise<void>;
  appliedCouponId: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [couponCode, setCouponCode] = useState(() => {
    return localStorage.getItem('couponCode') || '';
  });
  const [discount, setDiscount] = useState(() => {
    const saved = localStorage.getItem('discount');
    return saved ? Number(saved) : 0;
  });
  const [couponError, setCouponError] = useState<string | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null);
  const [cartRefreshing, setCartRefreshing] = useState(false);
const [cartRefreshError, setCartRefreshError] = useState<string | null>(null);

const itemsRef = useRef(items);
itemsRef.current = items;

const refreshInProgress =
  useRef<Promise<CartRefreshResult> | null>(null);

const refreshCart = useCallback((): Promise<CartRefreshResult> => {
  if (refreshInProgress.current) {
    return refreshInProgress.current;
  }

  const run = async (): Promise<CartRefreshResult> => {
    const currentItems = itemsRef.current;

    if (currentItems.length === 0) {
      setCartRefreshError(null);
      return { success: true, items: [] };
    }

    setCartRefreshing(true);
    setCartRefreshError(null);

    try {
      const variantIds = [
        ...new Set(
          currentItems.map(item => item.variant_id).filter(Boolean)
        ),
      ];

      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, product_id, status, is_active')
        .in('id', variantIds);

      if (variantsError) throw variantsError;

      const { data: prices, error: pricesError } = await supabase
  .from('variant_prices')
  .select('variant_id, mrp, selling_price, effective_from, effective_to')
  .eq('currency_code', 'INR')
  .in('variant_id', variantIds)
  .lte('effective_from', new Date().toISOString());

      if (pricesError) throw pricesError;

      const { data: inventory, error: inventoryError } = await supabase
        .from('variant_inventory')
        .select('variant_id, stock_quantity')
        .in('variant_id', variantIds);

      if (inventoryError) throw inventoryError;

      const now = Date.now();

      const variantMap = new Map(
        (variants || []).map(v => [v.id, v])
      );

      const priceMap = new Map<string, {
        mrp: number;
        selling_price: number;
        effective_from: string;
        effective_to: string | null;
      }>();

      for (const price of prices || []) {
        if (
          price.effective_to &&
          new Date(price.effective_to).getTime() <= now
        ) {
          continue;
        }

        const previous = priceMap.get(price.variant_id);

        if (
          !previous ||
          new Date(price.effective_from).getTime() >
          new Date(previous.effective_from).getTime()
        ) {
          priceMap.set(price.variant_id, price);
        }
      }

      const inventoryMap = new Map(
        (inventory || []).map(v => [v.variant_id, v.stock_quantity])
      );

      // Preserve cart items, including unavailable ones, so customers
      // can see and remove them rather than having them disappear.
      // Build a verified snapshot using the latest database values.
const refreshedItems: CartItem[] = currentItems.map(item => {
  const variant = variantMap.get(item.variant_id);
  const price = priceMap.get(item.variant_id);
  const stock = inventoryMap.get(item.variant_id);

  if (!variant || !price) {
    return {
      ...item,
      stock_quantity: 0,
    };
  }

  const available =
    variant.status === 'published' &&
    variant.is_active === true;

  return {
    ...item,
    price: Number(price.mrp),
    sale_price: Number(price.selling_price),
    stock_quantity: available
      ? Math.max(0, Number(stock ?? 0))
      : 0,
  };
});

// Update matching cart entries without restoring removed items
// or overwriting quantities changed while the request was running.
const refreshedMap = new Map(
  refreshedItems.map(item => [item.variant_id, item])
);

setItems(previousItems =>
  previousItems.map(item => {
    const refreshed = refreshedMap.get(item.variant_id);

    if (!refreshed) return item;

    return {
      ...item,
      price: refreshed.price,
      sale_price: refreshed.sale_price,
      stock_quantity: refreshed.stock_quantity,
    };
  })
);

return {
  success: true,
  items: refreshedItems,
};

    } catch (err) {
      console.error('Failed to refresh cart:', err);
      setCartRefreshError('Unable to verify current prices and availability.');
      return {
  success: false,
  items: [],
};
    } finally {
      setCartRefreshing(false);
    }
  };

  const promise = run();
  refreshInProgress.current = promise;
  void promise.finally(() => {
    if (refreshInProgress.current === promise) {
      refreshInProgress.current = null;
    }
  });

  return promise;
}, []);

  useEffect(() => {
  void refreshCart();

  const handleFocus = () => {
    void refreshCart();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void refreshCart();
    }
  };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [refreshCart]);

  const total = items.reduce((sum, item) => {
    const price = item.sale_price != null ? item.sale_price : item.price;
    return sum + price * item.quantity;
  }, 0);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('couponCode', couponCode);
  }, [couponCode]);

  useEffect(() => {
    localStorage.setItem('discount', String(discount));
  }, [discount]);

  const addToCart = (newItem: CartItem) => {
  setItems((prevItems) => {
    if (!newItem.variant_id || newItem.stock_quantity <= 0) {
      return prevItems;
    }

    const existing = prevItems.find(
      item => item.variant_id === newItem.variant_id
    );

    if (existing) {
      return prevItems.map(item =>
        item.variant_id === newItem.variant_id
          ? {
              ...item,
              ...newItem,
              quantity: Math.min(
                item.quantity + newItem.quantity,
                newItem.stock_quantity
              )
            }
          : item
      );
    }

    return [
      ...prevItems,
      {
        ...newItem,
        quantity: Math.min(
          Math.max(1, newItem.quantity),
          newItem.stock_quantity
        )
      }
    ];
  });
};

  const removeFromCart = (variantId: string) => {
  setItems(prevItems =>
    prevItems.filter(item => item.variant_id !== variantId)
  );
};

  const updateQuantity = (variantId: string, quantity: number) => {
  if (quantity <= 0) {
    removeFromCart(variantId);
    return;
  }

  setItems(prevItems =>
    prevItems.map(item => {
      if (item.variant_id !== variantId) return item;

      return {
        ...item,
        quantity: Math.min(
          Math.max(1, quantity),
          item.stock_quantity
        )
      };
    })
  );
};

  const clearCart = () => {
    setItems([]);
    setDiscount(0);
    setCouponCode('');
    setCouponError(null);
    setAppliedCouponId(null);
  };

  const fetchAvailableCoupons = async () => {
    try {
      const { data, error } = await supabase.rpc('get_available_coupons', {
        p_user_id: user?.id || null,
      });
      if (error) throw error;
      setAvailableCoupons((data || []) as AvailableCoupon[]);
    } catch (err) {
      console.error('Error fetching available coupons:', err);
    }
  };

  useEffect(() => {
    fetchAvailableCoupons();
  }, [user]);

  const buildCartItemsJson = () => {
    return JSON.stringify(
      items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
      }))
    );
  };

  const applyCoupon = async (): Promise<boolean> => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return false;
    }

    if (items.length === 0) {
      setCouponError('Add items to your cart before applying a coupon');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_coupon_code: couponCode.trim().toUpperCase(),
        p_cart_total: total,
        p_user_id: user?.id || null,
        p_payment_method: 'COD',
        p_cart_item_ids: items.map((i) => i.id),
        p_cart_categories: [],
        p_cart_items: buildCartItemsJson(),
      });

      if (error) throw error;

      const result = data?.[0] as CouponValidationResult | undefined;
      if (!result) {
        setCouponError('Failed to validate coupon');
        setDiscount(0);
        return false;
      }

      if (!result.valid) {
        setCouponError(result.error_message || 'Invalid coupon');
        setDiscount(0);
        setAppliedCouponId(null);
        return false;
      }

      setDiscount(result.discount_amount);
      setAppliedCouponId(result.coupon_id);
      setCouponError(null);
      return true;
    } catch {
      setCouponError('Failed to apply coupon. Please try again.');
      setDiscount(0);
      setAppliedCouponId(null);
      return false;
    }
  };

  const removeCoupon = () => {
    setCouponCode('');
    setDiscount(0);
    setCouponError(null);
    setAppliedCouponId(null);
  };

  // Re-validate coupon when cart items change if a coupon is applied
  useEffect(() => {
    if (couponCode && discount > 0 && items.length > 0) {
      applyCoupon();
    }
    if (items.length === 0 && discount > 0) {
      removeCoupon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, items.length]);

  return (
    <CartContext.Provider value={{
      items, total, refreshCart,
  cartRefreshing,
  cartRefreshError, addToCart, removeFromCart, updateQuantity, clearCart,
      couponCode, setCouponCode, discount, applyCoupon, removeCoupon, couponError,
      availableCoupons, fetchAvailableCoupons, appliedCouponId
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
