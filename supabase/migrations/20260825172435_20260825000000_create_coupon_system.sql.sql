-- ============================================================
-- COUPON & PROMOTIONAL OFFER SYSTEM
-- ============================================================

-- ── 1. Expand coupons table with new columns ──

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS max_discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_usage_limit integer,
  ADD COLUMN IF NOT EXISTS per_customer_usage_limit integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_order_only boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_stacking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS applicable_scope text DEFAULT 'entire_store'
    CHECK (applicable_scope IN ('entire_store','specific_categories','specific_products','specific_customers')),
  ADD COLUMN IF NOT EXISTS applicable_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_product_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_customer_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_restriction text DEFAULT 'all'
    CHECK (payment_restriction IN ('all','prepaid','cod'));

-- Change value column to numeric (was integer) to support decimal percentages
ALTER TABLE coupons ALTER COLUMN value TYPE numeric USING value::numeric;
ALTER TABLE coupons ALTER COLUMN minimum_order_amount TYPE numeric USING minimum_order_amount::numeric;
ALTER TABLE coupons ALTER COLUMN max_discount_amount TYPE numeric USING max_discount_amount::numeric;

-- ── 2. Coupon redemptions table ──

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  coupon_code text NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id ON coupon_redemptions(order_id);

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_redemptions" ON coupon_redemptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_redemption" ON coupon_redemptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_view_all_redemptions" ON coupon_redemptions FOR SELECT
  TO authenticated USING (is_admin());

-- Drop the old "Anyone can view active coupons" policy and replace with a more specific one
DROP POLICY IF EXISTS "Anyone can view active coupons" ON coupons;

-- Authenticated users can view active, non-expired coupons (for My Coupons / cart display)
CREATE POLICY "users_view_active_coupons" ON coupons FOR SELECT
  TO authenticated USING (
    active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (expiry_date IS NULL OR expiry_date > now())
  );

-- ── 3. Promotional popups table ──

CREATE TABLE IF NOT EXISTS promo_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  coupon_code text,
  discount_text text,
  cta_button_text text DEFAULT 'Shop Now',
  cta_destination text DEFAULT '/products',
  image_url text,
  background_url text,
  start_date timestamptz,
  end_date timestamptz,
  active boolean DEFAULT true,
  display_frequency text DEFAULT 'once_per_session'
    CHECK (display_frequency IN ('once_per_session','once_per_day','once_until_dismissed','show_again_after_days')),
  show_again_after_days integer DEFAULT 7,
  target_audience text DEFAULT 'all'
    CHECK (target_audience IN ('all','first_time_visitors','logged_out_only','new_customers_only')),
  minimum_order_value numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE promo_popups ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can see active popups for display
CREATE POLICY "anyone_view_active_popups" ON promo_popups FOR SELECT
  TO anon, authenticated USING (active = true);

-- Admins can manage popups
CREATE POLICY "admin_manage_popups" ON promo_popups FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── 4. Coupon settings (single-row table for stacking toggle) ──

CREATE TABLE IF NOT EXISTS coupon_settings (
  id integer PRIMARY KEY DEFAULT 1,
  allow_stacking boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO coupon_settings (id, allow_stacking) VALUES (1, false)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE coupon_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_view_coupon_settings" ON coupon_settings FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "admin_manage_coupon_settings" ON coupon_settings FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── 5. validate_coupon RPC ──
-- Validates a coupon server-side and returns the discount amount + metadata.
-- Does NOT create a redemption record (that happens via redeem_coupon).

CREATE OR REPLACE FUNCTION validate_coupon(
  p_coupon_code text,
  p_cart_total numeric,
  p_user_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'COD',
  p_cart_item_ids text[] DEFAULT '{}',
  p_cart_categories text[] DEFAULT '{}'
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
  total_usage_limit integer
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
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT * INTO v_coupon
    FROM coupons
    WHERE UPPER(code) = UPPER(p_coupon_code)
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, NULL::uuid, NULL::text, NULL::text, NULL::numeric,
      NULL::numeric, NULL::numeric, 'Coupon code not found', false, NULL::text, NULL::text, NULL::timestamptz, NULL::integer, NULL::integer;
    RETURN;
  END IF;

  -- Active check
  IF NOT v_coupon.active THEN
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, 'This coupon is inactive', v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
    RETURN;
  END IF;

  -- Date range checks
  IF v_coupon.start_date IS NOT NULL AND now() < v_coupon.start_date THEN
    v_error := 'This coupon is not active yet';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.start_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
    RETURN;
  END IF;

  IF v_coupon.expiry_date IS NOT NULL AND now() > v_coupon.expiry_date THEN
    v_error := 'This coupon has expired';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
    RETURN;
  END IF;

  -- Payment method restriction
  IF v_coupon.payment_restriction = 'prepaid' AND p_payment_method = 'COD' THEN
    v_error := 'This coupon is valid only for prepaid/online orders';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
    RETURN;
  END IF;

  IF v_coupon.payment_restriction = 'cod' AND p_payment_method <> 'COD' THEN
    v_error := 'This coupon is valid only for COD orders';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
    RETURN;
  END IF;

  -- Customer-specific check
  IF v_coupon.applicable_scope = 'specific_customers' THEN
    IF v_user_id IS NULL OR NOT (v_user_id = ANY(v_coupon.applicable_customer_ids)) THEN
      v_error := 'This coupon is assigned to specific customers only';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
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
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
      RETURN;
    END IF;
  END IF;

  -- Usage limit checks
  IF v_user_id IS NOT NULL AND v_coupon.per_customer_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_redemption_count >= v_coupon.per_customer_usage_limit THEN
      v_error := 'You have already used this coupon the maximum number of times';
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
        v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
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
        v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
      RETURN;
    END IF;
  END IF;

  -- Calculate eligible total based on scope
  v_eligible_total := p_cart_total;

  IF v_coupon.applicable_scope = 'specific_products' AND array_length(p_cart_item_ids, 1) IS NOT NULL THEN
    -- Only items whose IDs are in applicable_product_ids
    -- Frontend should pass cart item IDs; we can't re-compute here without cart data
    -- For scope-specific, the frontend should pass the eligible subtotal as p_cart_total
    -- Here we accept the passed total as the eligible total
    v_eligible_total := p_cart_total;
  END IF;

  IF v_coupon.applicable_scope = 'specific_categories' THEN
    -- Similarly, frontend passes eligible subtotal
    v_eligible_total := p_cart_total;
  END IF;

  -- Minimum order amount
  IF v_coupon.minimum_order_amount > 0 AND v_eligible_total < v_coupon.minimum_order_amount THEN
    v_error := 'Minimum order value ₹' || v_coupon.minimum_order_amount::text || ' required';
    RETURN QUERY SELECT false, 0::numeric, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
      v_coupon.minimum_order_amount, v_coupon.max_discount_amount, v_error, v_coupon.first_order_only,
      v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
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

  -- Prevent discount exceeding cart total
  IF v_discount > v_eligible_total THEN
    v_discount := v_eligible_total;
  END IF;

  v_discount := ROUND(v_discount, 2);

  RETURN QUERY SELECT true, v_discount, v_coupon.id, v_coupon.name, v_coupon.type, v_coupon.value,
    v_coupon.minimum_order_amount, v_coupon.max_discount_amount, NULL::text, v_coupon.first_order_only,
    v_coupon.payment_restriction, v_coupon.applicable_scope, v_coupon.expiry_date, v_coupon.per_customer_usage_limit, v_coupon.total_usage_limit;
  RETURN;
END;
$$;

-- Grant execute to authenticated and anon (anon needed for logged-out cart preview)
GRANT EXECUTE ON FUNCTION validate_coupon TO authenticated, anon;

-- ── 6. redeem_coupon RPC ──
-- Atomically validates + creates a redemption record tied to an order.
-- Uses FOR UPDATE lock to prevent concurrent over-redemption.

CREATE OR REPLACE FUNCTION redeem_coupon(
  p_coupon_code text,
  p_order_id uuid,
  p_user_id uuid,
  p_cart_total numeric,
  p_payment_method text DEFAULT 'COD'
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

  -- Per-customer usage limit
  IF v_coupon.per_customer_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id AND user_id = v_user_id;
    IF v_redemption_count >= v_coupon.per_customer_usage_limit THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'You have already used this coupon the maximum number of times';
      RETURN;
    END IF;
  END IF;

  -- Total usage limit
  IF v_coupon.total_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_redemption_count
      FROM coupon_redemptions
      WHERE coupon_id = v_coupon.id;
    IF v_total_redemption_count >= v_coupon.total_usage_limit THEN
      RETURN QUERY SELECT false, 0::numeric, v_coupon.id, 'This coupon has reached its total usage limit';
      RETURN;
    END IF;
  END IF;

  -- Calculate discount
  IF v_coupon.type = 'percentage' THEN
    v_discount := p_cart_total * v_coupon.value / 100;
    IF v_coupon.max_discount_amount > 0 AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.value;
  END IF;

  IF v_discount > p_cart_total THEN
    v_discount := p_cart_total;
  END IF;

  v_discount := ROUND(v_discount, 2);

  -- Create redemption record
  INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, coupon_code, discount_amount)
    VALUES (v_coupon.id, v_user_id, p_order_id, v_coupon.code, v_discount);

  RETURN QUERY SELECT true, v_discount, v_coupon.id, NULL::text;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_coupon TO authenticated;

-- ── 7. Helper: get available coupons for a user ──
-- Returns active, non-expired coupons the user can potentially use

CREATE OR REPLACE FUNCTION get_available_coupons(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  code text,
  name text,
  description text,
  type text,
  value numeric,
  minimum_order_amount numeric,
  max_discount_amount numeric,
  expiry_date timestamptz,
  first_order_only boolean,
  payment_restriction text,
  applicable_scope text,
  applicable_categories text[],
  applicable_product_ids text[],
  per_customer_usage_limit integer,
  total_usage_limit integer,
  used_count bigint,
  user_used_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  RETURN QUERY
    SELECT
      c.id,
      c.code,
      c.name,
      c.description,
      c.type,
      c.value,
      c.minimum_order_amount,
      c.max_discount_amount,
      c.expiry_date,
      c.first_order_only,
      c.payment_restriction,
      c.applicable_scope,
      c.applicable_categories,
      c.applicable_product_ids,
      c.per_customer_usage_limit,
      c.total_usage_limit,
      COUNT(cr.id) AS used_count,
      COALESCE(SUM(CASE WHEN cr.user_id = v_user_id THEN 1 ELSE 0 END), 0) AS user_used_count
    FROM coupons c
    LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
    WHERE c.active = true
      AND (c.start_date IS NULL OR c.start_date <= now())
      AND (c.expiry_date IS NULL OR c.expiry_date > now())
      AND (
        c.applicable_scope <> 'specific_customers'
        OR (v_user_id IS NOT NULL AND v_user_id = ANY(c.applicable_customer_ids))
      )
    GROUP BY c.id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_coupons TO authenticated, anon;

-- ── 8. Helper: check if user has completed orders (for popup eligibility) ──

CREATE OR REPLACE FUNCTION has_completed_orders(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM orders o
    JOIN order_statuses os ON o.order_status_id = os.id
    WHERE o.user_id = COALESCE(p_user_id, auth.uid())
      AND os.code NOT IN ('cancelled','rejected')
  );
$$;

GRANT EXECUTE ON FUNCTION has_completed_orders TO authenticated, anon;
