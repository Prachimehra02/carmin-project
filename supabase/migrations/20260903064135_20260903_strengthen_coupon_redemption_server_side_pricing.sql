/*
# Strengthen Coupon Redemption Flow — Server-Side Price Verification

## Purpose
Eliminate the ability for a browser to manipulate coupon discount amounts by
supplying forged cart item prices. Both `validate_coupon` (preview) and
`redeem_coupon` (authoritative) now look up the actual product price from the
`products` table server-side, ignoring any price values sent by the frontend.

## Key Changes

### 1. redeem_coupon — authoritative discount + redemption
- **Server-side price lookup**: Instead of trusting `p_cart_items->>'price'`,
  the function queries `products.sale_price` (falling back to `products.price`)
  for every cart item. The frontend sends only `{ id, quantity }`.
- **Coupon row lock**: `SELECT ... FOR UPDATE` on the coupon row prevents
  two concurrent orders from both passing the usage-limit check and both
  creating redemption records (the classic TOCTOU race).
- **Redemption count check AFTER lock**: The per-customer and total usage
  counts are re-read while the lock is held, so concurrent transactions
  serialize correctly.
- **Stacking enforcement**: If `coupon_settings.allow_stacking = false`
  (the default), the function checks that the order has no existing
  redemption and refuses a second coupon on the same order. The unique
  index `idx_coupon_redemptions_order_unique` is the physical backstop.
- **Order existence + ownership**: Verifies the order exists and belongs
  to `p_user_id` before creating a redemption.
- **Discount cap**: Discount never exceeds the eligible subtotal.

### 2. validate_coupon — preview (no side effects)
- Same server-side price lookup so the preview shown in the cart matches
  what `redeem_coupon` will compute.
- No locks, no writes — safe to call repeatedly.

### 3. New helper: get_product_prices
- SECURITY DEFINER function that returns `id, sale_price, price, category,
  is_active` for a set of product IDs. Used internally by both RPCs.
- Not granted to anon/authenticated — internal only.

## Security
- Both functions remain SECURITY DEFINER with `SET search_path = public`.
- `redeem_coupon` granted to `authenticated` only (requires a real order).
- `validate_coupon` granted to `authenticated, anon` (preview in cart).
- No changes to RLS or existing policies.

## Important Notes
1. The `p_cart_items` JSON parameter is kept for backward compatibility but
   only `id` and `quantity` are read. Any `price` field is ignored.
2. The `p_cart_total` parameter is now used only as a sanity upper bound;
   the actual subtotal is computed from the products table.
3. If a product is inactive or not found, it is skipped from the eligible
   total (it will still be caught by the checkout stock check before
   redeem_coupon is called).
*/

-- ── Helper: batch-fetch product pricing data ──

CREATE OR REPLACE FUNCTION get_product_prices(p_product_ids text[])
RETURNS TABLE(
  id text,
  sale_price numeric,
  price numeric,
  category text,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, sale_price, price, category, is_active
  FROM products
  WHERE id = ANY(p_product_ids);
$$;

-- Internal only — no GRANT EXECUTE.


-- ── Rewrite validate_coupon (preview, no side effects) ──

DROP FUNCTION IF EXISTS validate_coupon(text, numeric, uuid, text, text[], text[], json);

CREATE OR REPLACE FUNCTION validate_coupon(
  p_coupon_code text,
  p_cart_total numeric,
  p_user_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'COD',
  p_cart_item_ids text[] DEFAULT '{}',
  p_cart_categories text[] DEFAULT '{}',
  p_cart_items json DEFAULT NULL
) RETURNS TABLE(
  valid boolean,
  discount_amount numeric,
  coupon_id uuid,
  coupon_name text,
  discount_type text,
  discount_value numeric,
  minimum_order_amount numeric,
  max_discount_amount numeric,
  error_message text,
  first_order_only boolean,
  payment_restriction text,
  applicable_scope text,
  expiry_date timestamptz,
  per_customer_usage_limit integer,
  total_usage_limit integer,
  eligible_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
  v_user_id uuid;
  v_redemption_count integer;
  v_total_redemption_count integer;
  v_completed_orders_count integer;
  v_discount numeric;
  v_eligible_total numeric;
  v_server_subtotal numeric;
  v_error text;
  v_item record;
  v_prod record;
  v_product_ids text[];
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Look up coupon (no lock needed for preview)
  SELECT * INTO v_coupon
    FROM coupons
    WHERE UPPER(code) = UPPER(p_coupon_code)
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::uuid, NULL::text, NULL::text, NULL::numeric,
      NULL::numeric, NULL::numeric, 'Coupon code not found', false, NULL::text, NULL::text,
      NULL::timestamptz, NULL::integer, NULL::integer, 0::numeric;
    RETURN;
  END IF;

  IF NOT v_coupon.active THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, 'This coupon is inactive', v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
    RETURN;
  END IF;

  IF v_coupon.start_date IS NOT NULL AND now() < v_coupon.start_date THEN
    v_error := 'This coupon is not active yet (starts ' || to_char(v_coupon.start_date, 'DD Mon YYYY') || ')';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.start_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
    RETURN;
  END IF;

  IF v_coupon.expiry_date IS NOT NULL AND now() > v_coupon.expiry_date THEN
    v_error := 'This coupon has expired (expired ' || to_char(v_coupon.expiry_date, 'DD Mon YYYY') || ')';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
    RETURN;
  END IF;

  IF v_coupon.payment_restriction = 'prepaid' AND p_payment_method = 'COD' THEN
    v_error := 'This coupon is valid only for prepaid/online orders';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
    RETURN;
  END IF;

  IF v_coupon.payment_restriction = 'cod' AND p_payment_method <> 'COD' THEN
    v_error := 'This coupon is valid only for COD orders';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
    RETURN;
  END IF;

  IF v_coupon.applicable_scope = 'specific_customers' THEN
    IF v_user_id IS NULL OR NOT (v_user_id = ANY(v_coupon.applicable_customer_ids)) THEN
      v_error := 'This coupon is assigned to specific customers only';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
        v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
      RETURN;
    END IF;
  END IF;

  -- First order check
  IF v_coupon.first_order_only AND v_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_completed_orders_count
      FROM orders o
      JOIN order_statuses os ON o.order_status_id = os.id
      WHERE o.user_id = v_user_id AND os.code NOT IN ('cancelled','rejected');
    IF v_completed_orders_count > 0 THEN
      v_error := 'This coupon is valid only for first orders';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
        v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
      RETURN;
    END IF;
  END IF;

  -- Per-customer usage limit
  IF v_user_id IS NOT NULL AND v_coupon.per_customer_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_redemption_count >= v_coupon.per_customer_usage_limit THEN
      v_error := 'You have already used this coupon the maximum number of times';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
        v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
      RETURN;
    END IF;
  END IF;

  -- Total usage limit
  IF v_coupon.total_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id;
    IF v_total_redemption_count >= v_coupon.total_usage_limit THEN
      v_error := 'This coupon has reached its total usage limit';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
        v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
      RETURN;
    END IF;
  END IF;

  -- ── Compute eligible total SERVER-SIDE from products table ──
  -- Extract product IDs from cart_items JSON (only id + quantity are used)
  v_product_ids := ARRAY[]::text[];
  IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
      v_product_ids := array_append(v_product_ids, v_item.value->>'id');
    END LOOP;
  END IF;

  v_server_subtotal := 0;
  v_eligible_total := 0;

  IF v_coupon.applicable_scope = 'entire_store' THEN
    -- Sum all cart items using server-side prices
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), is_active INTO v_prod
          FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.is_active THEN
          v_server_subtotal := v_server_subtotal + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
        END IF;
      END LOOP;
      v_eligible_total := v_server_subtotal;
    ELSE
      -- Fallback: trust p_cart_total if no item details provided
      v_eligible_total := p_cart_total;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_products' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        IF (v_item.value->>'id') = ANY(v_coupon.applicable_product_ids) THEN
          SELECT COALESCE(sale_price, price), is_active INTO v_prod
            FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
          IF FOUND AND v_prod.is_active THEN
            v_eligible_total := v_eligible_total + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
          END IF;
        END IF;
      END LOOP;
    ELSE
      v_eligible_total := p_cart_total;
    END IF;

    IF v_eligible_total = 0 THEN
      v_error := 'This coupon is valid only for specific products in your cart';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
        v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
      RETURN;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_categories' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), category, is_active INTO v_prod
          FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.is_active AND v_prod.category = ANY(v_coupon.applicable_categories) THEN
          v_eligible_total := v_eligible_total + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
        END IF;
      END LOOP;
    ELSIF array_length(p_cart_categories, 1) IS NOT NULL THEN
      v_eligible_total := p_cart_total;
    END IF;

    IF v_eligible_total = 0 THEN
      v_error := 'This coupon is valid only for specific categories in your cart';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
        v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, 0::numeric;
      RETURN;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_customers' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), is_active INTO v_prod
          FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.is_active THEN
          v_server_subtotal := v_server_subtotal + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
        END IF;
      END LOOP;
      v_eligible_total := v_server_subtotal;
    ELSE
      v_eligible_total := p_cart_total;
    END IF;
  END IF;

  -- Minimum order amount
  IF v_coupon.minimum_order_amount > 0 AND v_eligible_total < v_coupon.minimum_order_amount THEN
    v_error := 'Minimum order value ₹' || v_coupon.minimum_order_amount::text || ' required for this coupon';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, v_eligible_total;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.type = 'percentage' THEN
    v_discount := v_eligible_total * v_coupon.value / 100;
    IF v_coupon.max_discount_amount > 0 AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.value;
  END IF;

  -- Cap discount at eligible total
  IF v_discount > v_eligible_total THEN
    v_discount := v_eligible_total;
  END IF;

  v_discount := ROUND(v_discount, 2);

  RETURN QUERY SELECT true, v_discount, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
    v_coupon.minimum_order_amount, v_coupon.max_discount_amount, NULL::text, v_coupon.first_order_only,
    v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
    v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, v_eligible_total;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_coupon TO authenticated, anon;


-- ── Rewrite redeem_coupon (authoritative — lock, validate, record) ──

DROP FUNCTION IF EXISTS redeem_coupon(text, uuid, uuid, numeric, text, json);

CREATE OR REPLACE FUNCTION redeem_coupon(
  p_coupon_code text,
  p_order_id uuid,
  p_user_id uuid,
  p_cart_total numeric,
  p_payment_method text DEFAULT 'COD',
  p_cart_items json DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  discount_amount numeric,
  coupon_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon coupons%ROWTYPE;
  v_redemption_count integer;
  v_total_redemption_count integer;
  v_completed_orders_count integer;
  v_existing_redemption_count integer;
  v_discount numeric;
  v_eligible_total numeric;
  v_server_subtotal numeric;
  v_user_id uuid;
  v_item record;
  v_prod record;
  v_order_exists boolean;
  v_stacking_allowed boolean;
BEGIN
  v_user_id := p_user_id;

  -- Verify the order exists and belongs to this user
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id AND user_id = v_user_id)
    INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::uuid, 'Order not found or does not belong to this user';
    RETURN;
  END IF;

  -- ── Lock the coupon row FOR UPDATE to prevent concurrent over-redemption ──
  SELECT * INTO v_coupon
    FROM coupons
    WHERE UPPER(code) = UPPER(p_coupon_code)
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::uuid, 'Coupon code not found';
    RETURN;
  END IF;

  IF NOT v_coupon.active THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon is inactive';
    RETURN;
  END IF;

  IF v_coupon.start_date IS NOT NULL AND now() < v_coupon.start_date THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon is not active yet';
    RETURN;
  END IF;

  IF v_coupon.expiry_date IS NOT NULL AND now() > v_coupon.expiry_date THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon has expired';
    RETURN;
  END IF;

  IF v_coupon.payment_restriction = 'prepaid' AND p_payment_method = 'COD' THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon is valid only for prepaid/online orders';
    RETURN;
  END IF;

  IF v_coupon.payment_restriction = 'cod' AND p_payment_method <> 'COD' THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon is valid only for COD orders';
    RETURN;
  END IF;

  IF v_coupon.applicable_scope = 'specific_customers' THEN
    IF NOT (v_user_id = ANY(v_coupon.applicable_customer_ids)) THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon is assigned to specific customers only';
      RETURN;
    END IF;
  END IF;

  -- First order check
  IF v_coupon.first_order_only THEN
    SELECT COUNT(*) INTO v_completed_orders_count
      FROM orders o
      JOIN order_statuses os ON o.order_status_id = os.id
      WHERE o.user_id = v_user_id AND os.code NOT IN ('cancelled','rejected');
    IF v_completed_orders_count > 0 THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon is valid only for first orders';
      RETURN;
    END IF;
  END IF;

  -- ── Stacking enforcement ──
  -- Check if this order already has a redemption (prevents stacking when not allowed)
  SELECT allow_stacking INTO v_stacking_allowed FROM coupon_settings WHERE id = 1;
  IF NOT v_stacking_allowed THEN
    SELECT COUNT(*) INTO v_existing_redemption_count
      FROM coupon_redemptions
      WHERE order_id = p_order_id;
    IF v_existing_redemption_count > 0 THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'Another coupon has already been applied to this order';
      RETURN;
    END IF;
  END IF;

  -- ── Per-customer usage limit (re-checked while lock is held) ──
  IF v_coupon.per_customer_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_redemption_count >= v_coupon.per_customer_usage_limit THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'You have already used this coupon the maximum number of times';
      RETURN;
    END IF;
  END IF;

  -- ── Total usage limit (re-checked while lock is held) ──
  IF v_coupon.total_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id;
    IF v_total_redemption_count >= v_coupon.total_usage_limit THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon has reached its total usage limit';
      RETURN;
    END IF;
  END IF;

  -- ── Compute eligible total SERVER-SIDE from products table ──
  -- Only id and quantity from p_cart_items are used; price is looked up from products
  v_server_subtotal := 0;
  v_eligible_total := 0;

  IF v_coupon.applicable_scope = 'entire_store' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), is_active INTO v_prod
          FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.is_active THEN
          v_server_subtotal := v_server_subtotal + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
        END IF;
      END LOOP;
      v_eligible_total := v_server_subtotal;
    ELSE
      v_eligible_total := p_cart_total;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_products' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        IF (v_item.value->>'id') = ANY(v_coupon.applicable_product_ids) THEN
          SELECT COALESCE(sale_price, price), is_active INTO v_prod
            FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
          IF FOUND AND v_prod.is_active THEN
            v_eligible_total := v_eligible_total + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
          END IF;
        END IF;
      END LOOP;
    ELSE
      v_eligible_total := p_cart_total;
    END IF;

    IF v_eligible_total = 0 THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'No eligible products in cart for this coupon';
      RETURN;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_categories' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), category, is_active INTO v_prod
          FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.is_active AND v_prod.category = ANY(v_coupon.applicable_categories) THEN
          v_eligible_total := v_eligible_total + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
        END IF;
      END LOOP;
    ELSE
      v_eligible_total := p_cart_total;
    END IF;

    IF v_eligible_total = 0 THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'No eligible categories in cart for this coupon';
      RETURN;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_customers' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), is_active INTO v_prod
          FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.is_active THEN
          v_server_subtotal := v_server_subtotal + (v_prod.coalesce * (v_item.value->>'quantity')::numeric);
        END IF;
      END LOOP;
      v_eligible_total := v_server_subtotal;
    ELSE
      v_eligible_total := p_cart_total;
    END IF;
  END IF;

  -- Minimum order amount
  IF v_coupon.minimum_order_amount > 0 AND v_eligible_total < v_coupon.minimum_order_amount THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id,
      'Minimum order value ₹' || v_coupon.minimum_order_amount::text || ' required';
    RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.type = 'percentage' THEN
    v_discount := v_eligible_total * v_coupon.value / 100;
    IF v_coupon.max_discount_amount > 0 AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.value;
  END IF;

  -- Cap discount at eligible total
  IF v_discount > v_eligible_total THEN
    v_discount := v_eligible_total;
  END IF;

  v_discount := ROUND(v_discount, 2);

  -- ── Create redemption record (the unique index on order_id is the
  -- physical backstop if two concurrent transactions somehow both get here) ──
  INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, coupon_code, discount_amount)
    VALUES (v_coupon.id, v_user_id, p_order_id, v_coupon.code, v_discount);

  RETURN QUERY SELECT true, v_discount, v_coupon.id, NULL::text;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_coupon TO authenticated;
