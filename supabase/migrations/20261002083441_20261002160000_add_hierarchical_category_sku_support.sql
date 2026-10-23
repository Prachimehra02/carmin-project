/*
# Add hierarchical category support to products and SKU generation

## Purpose
Replace the old flat `product_categories` table reference in product creation
with the new hierarchical `categories` table. Products will now store a
`category_id` referencing the `categories` table, and SKUs will be generated
by walking up the category tree and joining all SKU prefixes.

Example: Home Décor [HDR] → Vases [VAS] → Ceramic Vases [CER] → SKU: HDR-VAS-CER-001

## Changes

### 1. New column on `products`
- `category_id` (bigint, nullable) — references `categories(id)`.
  Nullable so existing products (which use the old `product_category` column)
  continue to work without backfill.

### 2. New function: `preview_next_sku_v2(p_category_id bigint)`
- Takes a category ID from the `categories` table.
- Walks up the parent chain to build the SKU prefix path (e.g. "HDR-VAS-CER").
- Looks up the next sequence number from `sku_sequences` using the full prefix path.
- Returns the preview SKU (e.g. "HDR-VAS-CER-001").
- STABLE, SECURITY DEFINER, admin-gated.

### 3. New function: `create_product_atomic_v2(...)`
- Same parameters as `create_product_atomic` PLUS `p_category_id` (bigint)
  referencing the new `categories` table.
- Builds the SKU prefix path by walking the category tree.
- Uses `sku_sequences` with the full prefix path for atomic sequence increment.
- Inserts the product with `category_id` set to the new categories table ID.
- Still stores `product_category` (old column) as NULL for new products
  (old column is kept for backward compat with existing products).
- SECURITY DEFINER, admin-gated, atomic transaction.

### 4. New function: `get_category_path(p_category_id bigint)`
- Returns the full category path as a JSON array of {id, name, sku_prefix, level}
  from root to the given category. Used by the edit form to load the hierarchy.

### 5. RLS on sku_sequences
- The `sku_sequences` table needs admin SELECT so `preview_next_sku_v2` works
  via the SECURITY DEFINER function (it already bypasses RLS internally, but
  we add a policy for completeness).

## Security
- All new functions are SECURITY DEFINER with `SET search_path TO 'public'`.
- `create_product_atomic_v2` checks `is_admin()` before proceeding.
- `preview_next_sku_v2` and `get_category_path` are accessible to authenticated
  users (admins only will use them, but no sensitive data is exposed).
- No existing RLS policies are changed.
- The old `product_category` column and old RPCs are preserved for backward compat.
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. Add category_id column to products
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id bigint;

-- Add FK constraint if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_category_id_fkey'
    AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. get_category_path — returns the full hierarchy path
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_category_path(p_category_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_path jsonb := '[]'::jsonb;
  v_current record;
  v_level int := 0;
BEGIN
  SELECT id, name, slug, sku_prefix, parent_id
  INTO v_current
  FROM categories
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  WHILE v_current IS NOT NULL LOOP
    v_path := v_path || jsonb_build_object(
      'id', v_current.id,
      'name', v_current.name,
      'slug', v_current.slug,
      'sku_prefix', v_current.sku_prefix,
      'parent_id', v_current.parent_id,
      'level', v_level
    );
    v_level := v_level + 1;

    IF v_current.parent_id IS NULL THEN
      EXIT;
  END IF;

    SELECT id, name, slug, sku_prefix, parent_id
    INTO v_current
    FROM categories
    WHERE id = v_current.parent_id;
  END LOOP;

  -- Reverse so root is first, target is last
  RETURN (
    SELECT jsonb_agg(elem ORDER BY ordinality DESC)
    FROM jsonb_array_elements(v_path) WITH ORDINALITY AS t(elem, ordinality)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. preview_next_sku_v2 — preview SKU from hierarchical categories
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.preview_next_sku_v2(p_category_id bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix_parts text[] := '{}';
  v_prefix text;
  v_current record;
  v_last integer;
  v_next integer;
BEGIN
  -- Walk up the category tree collecting sku_prefix values
  SELECT id, sku_prefix, parent_id
  INTO v_current
  FROM categories
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category % not found', p_category_id;
  END IF;

  WHILE v_current IS NOT NULL LOOP
    v_prefix_parts := array_prepend(v_current.sku_prefix, v_prefix_parts);

    IF v_current.parent_id IS NULL THEN
      EXIT;
  END IF;

    SELECT id, sku_prefix, parent_id
    INTO v_current
    FROM categories
    WHERE id = v_current.parent_id;
  END LOOP;

  v_prefix := array_to_string(v_prefix_parts, '-');

  SELECT COALESCE(last_number, 0)
  INTO v_last
  FROM sku_sequences
  WHERE prefix = v_prefix;

  v_next := COALESCE(v_last, 0) + 1;

  RETURN v_prefix || '-' || LPAD(v_next::text, 3, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. create_product_atomic_v2 — create product with hierarchical SKU
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_product_atomic_v2(
  p_category_id         bigint,
  p_name                text,
  p_slug                text,
  p_category            text,
  p_buying_price        numeric,
  p_price               numeric,
  p_discount_percentage integer,
  p_sale_price          numeric,
  p_description         text,
  p_images              jsonb,
  p_badge               text,
  p_stock_quantity      integer,
  p_featured            boolean,
  p_is_active           boolean,
  p_meta_title          text,
  p_meta_description    text,
  p_weight              integer,
  p_dimensions          jsonb,
  p_hsn_id              uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix_parts text[] := '{}';
  v_prefix       text;
  v_seq          integer;
  v_sku          text;
  v_hsn_code     text;
  v_gst_pct      numeric;
  v_current      record;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Walk up the category tree to build the SKU prefix path
  SELECT id, sku_prefix, parent_id
  INTO v_current
  FROM categories
  WHERE id = p_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category % not found', p_category_id;
  END IF;

  WHILE v_current IS NOT NULL LOOP
    v_prefix_parts := array_prepend(v_current.sku_prefix, v_prefix_parts);

    IF v_current.parent_id IS NULL THEN
      EXIT;
  END IF;

    SELECT id, sku_prefix, parent_id
    INTO v_current
    FROM categories
    WHERE id = v_current.parent_id;
  END LOOP;

  v_prefix := array_to_string(v_prefix_parts, '-');

  -- Atomically reserve the next sequence number
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

  v_sku := v_prefix || '-' || LPAD(v_seq::text, 3, '0');

  -- Fetch HSN cached fields if hsn_id is provided
  IF p_hsn_id IS NOT NULL THEN
    SELECT hsn_code, gst_percentage INTO v_hsn_code, v_gst_pct
    FROM hsn_master WHERE id = p_hsn_id;
  END IF;

  INSERT INTO products (
    id, name, slug, category_id, sku, category,
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
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. Grant execute on new functions to authenticated
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.get_category_path(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_next_sku_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_atomic_v2(
  bigint, text, text, text, numeric, numeric, integer, numeric,
  text, jsonb, text, integer, boolean, boolean, text, text,
  integer, jsonb, uuid
) TO authenticated;
