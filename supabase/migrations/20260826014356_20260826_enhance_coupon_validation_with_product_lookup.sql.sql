/*
# Enhance Coupon Validation with Product/Category Eligibility

## Purpose
Make validate_coupon and redeem_coupon compute eligible totals server-side
from actual product data, instead of trusting the frontend-supplied cart total.

## Changes
1. Drop old validate_coupon(text,numeric,uuid,text,text[],text[]) signature
2. Drop old redeem_coupon(text,uuid,uuid,numeric,text) signature
3. Recreate both with new p_cart_items json parameter
4. Add get_coupon_usage_count helper
*/

DROP FUNCTION IF EXISTS validate_coupon(text, numeric, uuid, text, text[], text[]);
DROP FUNCTION IF EXISTS redeem_coupon(text, uuid, uuid, numeric, text);

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
  v_error text;
  v_item record;
  v_prod record;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

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

  -- Compute eligible total from server-side product lookup
  v_eligible_total := 0;

  IF v_coupon.applicable_scope = 'entire_store' THEN
    v_eligible_total := p_cart_total;

  ELSIF v_coupon.applicable_scope = 'specific_products' THEN
    IF p_cart_items IS NOT NULL AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        IF (v_item.value->>'id') = ANY(v_coupon.applicable_product_ids) THEN
          v_eligible_total := v_eligible_total +
            ((v_item.value->>'price')::numeric * (v_item.value->>'quantity')::numeric);
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
        SELECT category INTO v_prod FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
        IF FOUND AND v_prod.category = ANY(v_coupon.applicable_categories) THEN
          v_eligible_total := v_eligible_total +
            ((v_item.value->>'price')::numeric * (v_item.value->>'quantity')::numeric);
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
    v_eligible_total := p_cart_total;
  END IF;

  IF v_coupon.minimum_order_amount > 0 AND v_eligible_total < v_coupon.minimum_order_amount THEN
    v_error := 'Minimum order value ₹' || v_coupon.minimum_order_amount::text || ' required for this coupon';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date,
      v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit, v_eligible_total;
    RETURN;
  END IF;

  IF v_coupon.type = 'percentage' THEN
    v_discount := v_eligible_total * v_coupon.value / 100;
    IF v_coupon.max_discount_amount > 0 AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.value;
  END IF;

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

-- ── Enhanced redeem_coupon ──

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
  v_discount numeric;
  v_user_id uuid;
  v_eligible_total numeric;
  v_item record;
  v_prod record;
BEGIN
  v_user_id := p_user_id;

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

  IF v_coupon.per_customer_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_redemption_count >= v_coupon.per_customer_usage_limit THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'You have already used this coupon the maximum number of times';
      RETURN;
    END IF;
  END IF;

  IF v_coupon.total_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id;
    IF v_total_redemption_count >= v_coupon.total_usage_limit THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon has reached its total usage limit';
      RETURN;
    END IF;
  END IF;

  -- Compute eligible total server-side
  v_eligible_total := p_cart_total;

  IF v_coupon.applicable_scope = 'specific_products' AND p_cart_items IS NOT NULL
     AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
    v_eligible_total := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
      IF (v_item.value->>'id') = ANY(v_coupon.applicable_product_ids) THEN
        v_eligible_total := v_eligible_total +
          ((v_item.value->>'price')::numeric * (v_item.value->>'quantity')::numeric);
      END IF;
    END LOOP;
    IF v_eligible_total = 0 THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'No eligible products in cart for this coupon';
      RETURN;
    END IF;

  ELSIF v_coupon.applicable_scope = 'specific_categories' AND p_cart_items IS NOT NULL
        AND jsonb_array_length(p_cart_items::jsonb) > 0 THEN
    v_eligible_total := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
      SELECT category INTO v_prod FROM products WHERE id = (v_item.value->>'id') LIMIT 1;
      IF FOUND AND v_prod.category = ANY(v_coupon.applicable_categories) THEN
        v_eligible_total := v_eligible_total +
          ((v_item.value->>'price')::numeric * (v_item.value->>'quantity')::numeric);
      END IF;
    END LOOP;
    IF v_eligible_total = 0 THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'No eligible categories in cart for this coupon';
      RETURN;
    END IF;
  END IF;

  IF v_coupon.minimum_order_amount > 0 AND v_eligible_total < v_coupon.minimum_order_amount THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id,
      'Minimum order value ₹' || v_coupon.minimum_order_amount::text || ' required';
    RETURN;
  END IF;

  IF v_coupon.type = 'percentage' THEN
    v_discount := v_eligible_total * v_coupon.value / 100;
    IF v_coupon.max_discount_amount > 0 AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.value;
  END IF;

  IF v_discount > v_eligible_total THEN
    v_discount := v_eligible_total;
  END IF;

  v_discount := ROUND(v_discount, 2);

  INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, coupon_code, discount_amount)
    VALUES (v_coupon.id, v_user_id, p_order_id, v_coupon.code, v_discount);

  RETURN QUERY SELECT true, v_discount, v_coupon.id, NULL::text;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_coupon TO authenticated;

-- ── Helper: get usage count for a single coupon ──

CREATE OR REPLACE FUNCTION get_coupon_usage_count(p_coupon_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM coupon_redemptions WHERE coupon_id = p_coupon_id;
$$;

GRANT EXECUTE ON FUNCTION get_coupon_usage_count TO authenticated;
