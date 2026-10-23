/*
# Fix preview_next_sku_v2 and get_category_path with recursive CTE

The previous version had a bug in the WHILE loop that caused it to miss
the root category. This version uses a recursive CTE which is more reliable
for tree traversal.
*/

-- ═══════════════════════════════════════════════════════════════
-- Fix get_category_path
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_category_path(p_category_id bigint)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE path_cte AS (
    SELECT id, name, slug, sku_prefix, parent_id, 0 as level
    FROM categories
    WHERE id = p_category_id
    UNION ALL
    SELECT c.id, c.name, c.slug, c.sku_prefix, c.parent_id, p.level + 1
    FROM categories c
    JOIN path_cte p ON c.id = p.parent_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'slug', slug,
      'sku_prefix', sku_prefix,
      'parent_id', parent_id,
      'level', level
    )
    ORDER BY level DESC
  )
  FROM path_cte;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Fix preview_next_sku_v2
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.preview_next_sku_v2(p_category_id bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix text;
  v_last integer;
  v_next integer;
BEGIN
  -- Build the SKU prefix by walking up the tree using a recursive CTE
  WITH RECURSIVE path_cte AS (
    SELECT id, sku_prefix, parent_id
    FROM categories
    WHERE id = p_category_id
    UNION ALL
    SELECT c.id, c.sku_prefix, c.parent_id
    FROM categories c
    JOIN path_cte p ON c.id = p.parent_id
  )
  SELECT string_agg(sku_prefix, '-' ORDER BY level DESC)
  INTO v_prefix
  FROM (
    SELECT sku_prefix, row_number() OVER () as level
    FROM path_cte
  ) ordered;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'Category % not found', p_category_id;
  END IF;

  SELECT COALESCE(last_number, 0)
  INTO v_last
  FROM sku_sequences
  WHERE prefix = v_prefix;

  v_next := COALESCE(v_last, 0) + 1;

  RETURN v_prefix || '-' || LPAD(v_next::text, 3, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Fix create_product_atomic_v2 — same recursive CTE approach
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
  v_prefix   text;
  v_seq      integer;
  v_sku      text;
  v_hsn_code text;
  v_gst_pct  numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Build the SKU prefix by walking up the tree using a recursive CTE
  WITH RECURSIVE path_cte AS (
    SELECT id, sku_prefix, parent_id, 0 as depth
    FROM categories
    WHERE id = p_category_id
    UNION ALL
    SELECT c.id, c.sku_prefix, c.parent_id, p.depth + 1
    FROM categories c
    JOIN path_cte p ON c.id = p.parent_id
  )
  SELECT string_agg(sku_prefix, '-' ORDER BY depth DESC)
  INTO v_prefix
  FROM path_cte;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'Category % not found', p_category_id;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_category_path(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_next_sku_v2(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_atomic_v2(
  bigint, text, text, text, numeric, numeric, integer, numeric,
  text, jsonb, text, integer, boolean, boolean, text, text,
  integer, jsonb, uuid
) TO authenticated;
