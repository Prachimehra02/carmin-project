/*
# Phase 1 Database Cleanup

Removes legacy fields and makes the order system rely entirely on the
normalized architecture (hsn_master, order_statuses, payment_statuses,
return_statuses, order_items).

## What's removed:
1. orders.status (text) — replaced by order_status_id FK
2. orders.order_status (text) — replaced by order_status_id FK
3. orders.payment_status (text) — replaced by payment_status_id FK
4. orders.items (jsonb) — replaced by order_items table
5. orders.total (numeric) — replaced by grand_total
6. products.tax_rate_id (bigint) — replaced by hsn_id FK to hsn_master
7. tax_rates table — replaced by hsn_master

## What's preserved:
- products.category (text) — still used by frontend
- products.product_category (bigint) — still used
- All data in order_items, hsn_master, order_statuses, etc.

## RPC update:
- create_product_atomic: drop the p_tax_rate_id overload, add p_hsn_id
  parameter to insert HSN reference
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. Update create_product_atomic RPC
-- ═══════════════════════════════════════════════════════════════

-- Drop both existing overloads
DROP FUNCTION IF EXISTS create_product_atomic(
  bigint, text, text, text, numeric, numeric, integer, numeric, text,
  jsonb, text, integer, boolean, boolean, text, text, integer, jsonb
);
DROP FUNCTION IF EXISTS create_product_atomic(
  bigint, text, text, text, numeric, numeric, integer, numeric, text,
  jsonb, text, integer, boolean, boolean, text, text, integer, jsonb, bigint
);

-- Recreate with p_hsn_id parameter
CREATE OR REPLACE FUNCTION create_product_atomic(
  p_category_id bigint,
  p_name text,
  p_slug text,
  p_category text,
  p_buying_price numeric,
  p_price numeric,
  p_discount_percentage integer,
  p_sale_price numeric,
  p_description text,
  p_images jsonb,
  p_badge text,
  p_stock_quantity integer,
  p_featured boolean,
  p_is_active boolean,
  p_meta_title text,
  p_meta_description text,
  p_weight integer,
  p_dimensions jsonb,
  p_hsn_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix    text;
  v_seq       integer;
  v_sku       text;
  v_hsn_code  text;
  v_gst_pct   numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  SELECT prefix INTO v_prefix
  FROM product_categories
  WHERE id = p_category_id;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Product category % not found', p_category_id;
  END IF;

  INSERT INTO sku_sequences (prefix, last_number)
  VALUES (v_prefix, 0)
  ON CONFLICT (prefix) DO NOTHING;

  SELECT last_number INTO v_seq
  FROM sku_sequences
  WHERE prefix = v_prefix
  FOR UPDATE;

  v_seq := v_seq + 1;

  UPDATE sku_sequences
  SET last_number = v_seq
  WHERE prefix = v_prefix;

  v_sku := v_prefix || LPAD(v_seq::text, 6, '0');

  -- Fetch HSN cached fields if hsn_id is provided
  IF p_hsn_id IS NOT NULL THEN
    SELECT hsn_code, gst_percentage INTO v_hsn_code, v_gst_pct
    FROM hsn_master WHERE id = p_hsn_id;
  END IF;

  INSERT INTO products (
    id, name, slug, product_category, sku, category,
    buying_price, price, discount_percentage, sale_price,
    description, images, badge, stock_quantity,
    featured, is_active, meta_title, meta_description,
    weight, dimensions, hsn_id, hsn_code, gst_percentage
  ) VALUES (
    v_sku, p_name, p_slug, p_category_id, v_sku, p_category,
    p_buying_price, p_price, p_discount_percentage, p_sale_price,
    p_description, p_images, NULLIF(p_badge, ''), p_stock_quantity,
    p_featured, p_is_active, NULLIF(p_meta_title, ''), NULLIF(p_meta_description, ''),
    NULLIF(p_weight, 0), p_dimensions, p_hsn_id, v_hsn_code, v_gst_pct
  );

  RETURN v_sku;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Drop legacy order columns
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE orders DROP COLUMN IF EXISTS status;
ALTER TABLE orders DROP COLUMN IF EXISTS order_status;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;
ALTER TABLE orders DROP COLUMN IF EXISTS items;
ALTER TABLE orders DROP COLUMN IF EXISTS total;

-- ═══════════════════════════════════════════════════════════════
-- 3. Drop legacy product column
-- ═══════════════════════════════════════════════════════════════

-- Drop FK constraint first if it exists
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_tax_rate;
ALTER TABLE products DROP COLUMN IF EXISTS tax_rate_id;

-- ═══════════════════════════════════════════════════════════════
-- 4. Drop tax_rates table
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS tax_rates;
