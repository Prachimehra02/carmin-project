/*
# Fix FOR UPDATE on outer join in create_order_atomic

FOR UPDATE cannot be applied to the nullable side of an outer join.
Changed "FOR UPDATE" to "FOR UPDATE OF p" to lock only the products row.
*/

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_user_id uuid,
  p_cart_items json,
  p_shipping_address jsonb,
  p_shipping_charge numeric DEFAULT 0,
  p_payment_method text DEFAULT 'COD',
  p_coupon_code text DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  order_id uuid,
  order_number text,
  discount numeric,
  grand_total numeric,
  error_message text,
  items json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_total_tax numeric := 0;
  v_discount numeric := 0;
  v_final_coupon_code text := '';
  v_grand_total numeric;
  v_item json;
  v_prod record;
  v_unit_price numeric;
  v_line_subtotal numeric;
  v_line_tax numeric;
  v_gst_pct numeric;
  v_hsn_code text;
  v_cgst_pct numeric;
  v_sgst_pct numeric;
  v_igst_pct numeric;
  v_cess_pct numeric;
  v_order_status_id uuid;
  v_payment_status_id uuid;
  v_return_status_id uuid;
  v_items_json json := '[]'::json;

  -- Coupon-related
  v_coupon coupons%ROWTYPE;
  v_coupon_id uuid;
  v_coupon_code_upper text;
  v_redemption_count integer;
  v_total_redemption_count integer;
  v_completed_orders_count integer;
  v_eligible_total numeric;
  v_server_subtotal numeric;
  v_stacking_allowed boolean;
  v_coupon_item json;
  v_coupon_prod record;
BEGIN
  -- ── Sanity: cart must not be empty ──
  IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items::jsonb) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- ── Resolve status IDs ──
  SELECT id INTO v_order_status_id FROM order_statuses WHERE code = 'order_placed';
  IF v_order_status_id IS NULL THEN
    RAISE EXCEPTION 'Order status "order_placed" not found in master table';
  END IF;

  SELECT id INTO v_payment_status_id FROM payment_statuses WHERE code = 'pending';
  IF v_payment_status_id IS NULL THEN
    RAISE EXCEPTION 'Payment status "pending" not found in master table';
  END IF;

  SELECT id INTO v_return_status_id FROM return_statuses WHERE code = 'none';
  IF v_return_status_id IS NULL THEN
    RAISE EXCEPTION 'Return status "none" not found in master table';
  END IF;

  -- ── Step 1: Validate each cart item and compute prices/tax server-side ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
    SELECT
      p.id,
      p.stock_quantity,
      p.is_active,
      p.sku,
      p.name,
      p.sale_price,
      p.price,
      p.gst_percentage,
      p.hsn_code,
      p.category,
      h.gst_percentage  AS hsn_gst,
      h.cgst_percentage AS hsn_cgst,
      h.sgst_percentage AS hsn_sgst,
      h.igst_percentage AS hsn_igst,
      h.cess_percentage AS hsn_cess,
      h.hsn_code        AS hsn_hsn_code
    INTO v_prod
    FROM products p
    LEFT JOIN hsn_master h ON p.hsn_id = h.id
    WHERE p.id = (v_item->>'id')
    FOR UPDATE OF p;  -- Lock only the products row, not the nullable hsn side

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', (v_item->>'id');
    END IF;

    IF NOT v_prod.is_active THEN
      RAISE EXCEPTION '% is no longer available', v_prod.name;
    END IF;

    IF v_prod.stock_quantity < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION '% has only % units in stock', v_prod.name, v_prod.stock_quantity;
    END IF;

    -- Server-side price: sale_price takes priority over price
    v_unit_price := COALESCE(v_prod.sale_price, v_prod.price);
    v_gst_pct := COALESCE(v_prod.gst_percentage, v_prod.hsn_gst, 0);
    v_hsn_code := COALESCE(v_prod.hsn_code, v_prod.hsn_hsn_code, NULL);
    v_cgst_pct := COALESCE(v_prod.hsn_cgst, 0);
    v_sgst_pct := COALESCE(v_prod.hsn_sgst, 0);
    v_igst_pct := COALESCE(v_prod.hsn_igst, v_gst_pct);
    v_cess_pct := COALESCE(v_prod.hsn_cess, 0);

    v_line_subtotal := v_unit_price * (v_item->>'quantity')::numeric;
    v_line_tax := (v_line_subtotal * v_gst_pct) / 100;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_total_tax := v_total_tax + v_line_tax;

    -- Build items JSON for return to frontend
    v_items_json := jsonb_build_array(
      v_items_json::jsonb,
      jsonb_build_object(
        'id', v_prod.id,
        'name', v_prod.name,
        'sku', v_prod.sku,
        'quantity', (v_item->>'quantity')::integer,
        'unitPrice', v_unit_price,
        'gstPercentage', v_gst_pct,
        'hsnCode', v_hsn_code,
        'cgstPercentage', v_cgst_pct,
        'sgstPercentage', v_sgst_pct,
        'igstPercentage', v_igst_pct,
        'cessPercentage', v_cess_pct,
        'lineSubtotal', v_line_subtotal,
        'lineTax', v_line_tax
      )
    )::json;
  END LOOP;

  -- ── Step 2: Validate coupon (if provided) ──
  -- Reuses the SAME rules as redeem_coupon: active, date, payment restriction,
  -- first-order-only, per-customer/total limits, scope, min order, max discount.
  -- The coupon row is locked FOR UPDATE to prevent concurrent over-redemption.
  v_coupon_code_upper := NULLIF(TRIM(p_coupon_code), '');

  IF v_coupon_code_upper IS NOT NULL THEN
    v_coupon_code_upper := UPPER(v_coupon_code_upper);

    SELECT * INTO v_coupon
      FROM coupons
      WHERE UPPER(code) = v_coupon_code_upper
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coupon code not found';
    END IF;

    IF NOT v_coupon.active THEN
      RAISE EXCEPTION 'This coupon is inactive';
    END IF;

    IF v_coupon.start_date IS NOT NULL AND now() < v_coupon.start_date THEN
      RAISE EXCEPTION 'This coupon is not active yet';
    END IF;

    IF v_coupon.expiry_date IS NOT NULL AND now() > v_coupon.expiry_date THEN
      RAISE EXCEPTION 'This coupon has expired';
    END IF;

    IF v_coupon.payment_restriction = 'prepaid' AND p_payment_method = 'COD' THEN
      RAISE EXCEPTION 'This coupon is valid only for prepaid/online orders';
    END IF;

    IF v_coupon.payment_restriction = 'cod' AND p_payment_method <> 'COD' THEN
      RAISE EXCEPTION 'This coupon is valid only for COD orders';
    END IF;

    IF v_coupon.applicable_scope = 'specific_customers' THEN
      IF NOT (p_user_id = ANY(v_coupon.applicable_customer_ids)) THEN
        RAISE EXCEPTION 'This coupon is assigned to specific customers only';
      END IF;
    END IF;

    -- First-order check
    IF v_coupon.first_order_only THEN
      SELECT COUNT(*) INTO v_completed_orders_count
        FROM orders o
        JOIN order_statuses os ON o.order_status_id = os.id
        WHERE o.user_id = p_user_id AND os.code NOT IN ('cancelled','rejected');
      IF v_completed_orders_count > 0 THEN
        RAISE EXCEPTION 'This coupon is valid only for first orders';
      END IF;
    END IF;

    -- Per-customer usage limit
    IF v_coupon.per_customer_usage_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_redemption_count
        FROM coupon_redemptions
        WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
      IF v_redemption_count >= v_coupon.per_customer_usage_limit THEN
        RAISE EXCEPTION 'You have already used this coupon the maximum number of times';
      END IF;
    END IF;

    -- Total usage limit
    IF v_coupon.total_usage_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_total_redemption_count
        FROM coupon_redemptions
        WHERE coupon_id = v_coupon.id;
      IF v_total_redemption_count >= v_coupon.total_usage_limit THEN
        RAISE EXCEPTION 'This coupon has reached its total usage limit';
      END IF;
    END IF;

    -- Stacking: since this is a new order, there can't be an existing
    -- redemption on it. But check the setting for completeness.
    SELECT allow_stacking INTO v_stacking_allowed FROM coupon_settings WHERE id = 1;

    -- Compute eligible total server-side from products (same logic as redeem_coupon)
    v_server_subtotal := 0;
    v_eligible_total := 0;

    IF v_coupon.applicable_scope = 'entire_store' THEN
      FOR v_coupon_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), is_active INTO v_coupon_prod
          FROM products WHERE id = (v_coupon_item->>'id') LIMIT 1;
        IF FOUND AND v_coupon_prod.is_active THEN
          v_server_subtotal := v_server_subtotal + (v_coupon_prod.coalesce * (v_coupon_item->>'quantity')::numeric);
        END IF;
      END LOOP;
      v_eligible_total := v_server_subtotal;

    ELSIF v_coupon.applicable_scope = 'specific_products' THEN
      FOR v_coupon_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        IF (v_coupon_item->>'id') = ANY(v_coupon.applicable_product_ids) THEN
          SELECT COALESCE(sale_price, price), is_active INTO v_coupon_prod
            FROM products WHERE id = (v_coupon_item->>'id') LIMIT 1;
          IF FOUND AND v_coupon_prod.is_active THEN
            v_eligible_total := v_eligible_total + (v_coupon_prod.coalesce * (v_coupon_item->>'quantity')::numeric);
          END IF;
        END IF;
      END LOOP;
      IF v_eligible_total = 0 THEN
        RAISE EXCEPTION 'No eligible products in cart for this coupon';
      END IF;

    ELSIF v_coupon.applicable_scope = 'specific_categories' THEN
      FOR v_coupon_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), category, is_active INTO v_coupon_prod
          FROM products WHERE id = (v_coupon_item->>'id') LIMIT 1;
        IF FOUND AND v_coupon_prod.is_active AND v_coupon_prod.category = ANY(v_coupon.applicable_categories) THEN
          v_eligible_total := v_eligible_total + (v_coupon_prod.coalesce * (v_coupon_item->>'quantity')::numeric);
        END IF;
      END LOOP;
      IF v_eligible_total = 0 THEN
        RAISE EXCEPTION 'No eligible categories in cart for this coupon';
      END IF;

    ELSIF v_coupon.applicable_scope = 'specific_customers' THEN
      FOR v_coupon_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
        SELECT COALESCE(sale_price, price), is_active INTO v_coupon_prod
          FROM products WHERE id = (v_coupon_item->>'id') LIMIT 1;
        IF FOUND AND v_coupon_prod.is_active THEN
          v_server_subtotal := v_server_subtotal + (v_coupon_prod.coalesce * (v_coupon_item->>'quantity')::numeric);
        END IF;
      END LOOP;
      v_eligible_total := v_server_subtotal;
    END IF;

    -- Minimum order amount
    IF v_coupon.minimum_order_amount > 0 AND v_eligible_total < v_coupon.minimum_order_amount THEN
      RAISE EXCEPTION 'Minimum order value ₹% required for this coupon', v_coupon.minimum_order_amount::text;
    END IF;

    -- Calculate discount (same formula as redeem_coupon)
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
    v_final_coupon_code := v_coupon.code;
    v_coupon_id := v_coupon.id;
  END IF;

  -- ── Step 3: Generate order number ──
  v_order_number := generate_order_number();

  -- ── Step 4: Insert the order with the final discount ──
  v_grand_total := v_subtotal + v_total_tax + p_shipping_charge - v_discount;

  INSERT INTO orders (
    order_number, user_id,
    order_status_id, payment_status_id, return_status_id,
    subtotal, shipping_charge, discount, tax_amount, grand_total,
    payment_method, courier_name, awb_number, expected_delivery,
    shipping_address, coupon_code
  ) VALUES (
    v_order_number, p_user_id,
    v_order_status_id, v_payment_status_id, v_return_status_id,
    v_subtotal, p_shipping_charge, v_discount, v_total_tax, v_grand_total,
    p_payment_method, NULL, NULL, NULL,
    p_shipping_address, NULLIF(v_final_coupon_code, '')
  )
  RETURNING id INTO v_order_id;

  -- ── Step 5: Insert order_items ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
    SELECT
      p.sku, p.name,
      COALESCE(p.sale_price, p.price) AS unit_price,
      p.gst_percentage,
      p.hsn_code,
      h.gst_percentage  AS hsn_gst,
      h.cgst_percentage AS hsn_cgst,
      h.sgst_percentage AS hsn_sgst,
      h.igst_percentage AS hsn_igst,
      h.cess_percentage AS hsn_cess,
      h.hsn_code        AS hsn_hsn_code
    INTO v_prod
    FROM products p
    LEFT JOIN hsn_master h ON p.hsn_id = h.id
    WHERE p.id = (v_item->>'id');

    v_unit_price := v_prod.unit_price;
    v_gst_pct := COALESCE(v_prod.gst_percentage, v_prod.hsn_gst, 0);
    v_hsn_code := COALESCE(v_prod.hsn_code, v_prod.hsn_hsn_code, NULL);
    v_cgst_pct := COALESCE(v_prod.hsn_cgst, 0);
    v_sgst_pct := COALESCE(v_prod.hsn_sgst, 0);
    v_igst_pct := COALESCE(v_prod.hsn_igst, v_gst_pct);
    v_cess_pct := COALESCE(v_prod.hsn_cess, 0);

    v_line_subtotal := v_unit_price * (v_item->>'quantity')::numeric;
    v_line_tax := (v_line_subtotal * v_gst_pct) / 100;

    INSERT INTO order_items (
      order_id, product_id, product_name, product_sku,
      quantity, price, tax_percentage, tax_amount, line_total,
      hsn_code, cgst_percentage, sgst_percentage, igst_percentage, cess_percentage
    ) VALUES (
      v_order_id, (v_item->>'id'), v_prod.name, v_prod.sku,
      (v_item->>'quantity')::integer, v_unit_price,
      v_gst_pct, v_line_tax, v_line_subtotal,
      v_hsn_code, v_cgst_pct, v_sgst_pct, v_igst_pct, v_cess_pct
    );
  END LOOP;

  -- ── Step 6: Decrement stock ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items::jsonb) LOOP
    UPDATE products
      SET stock_quantity = stock_quantity - (v_item->>'quantity')::integer
      WHERE id = (v_item->>'id')
        AND stock_quantity >= (v_item->>'quantity')::integer;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for product % — please try again', (v_item->>'id');
    END IF;
  END LOOP;

  -- ── Step 7: Record coupon redemption ──
  IF v_coupon_id IS NOT NULL THEN
    INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, coupon_code, discount_amount)
      VALUES (v_coupon_id, p_user_id, v_order_id, v_final_coupon_code, v_discount);
  END IF;

  -- ── Success: return order details ──
  RETURN QUERY SELECT true, v_order_id, v_order_number, v_discount, v_grand_total, NULL::text, v_items_json;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_atomic TO authenticated;
