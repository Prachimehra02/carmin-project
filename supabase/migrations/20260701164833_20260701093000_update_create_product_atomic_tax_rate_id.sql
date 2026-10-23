-- Adds p_tax_rate_id to create_product_atomic and inserts it into products.tax_rate_id.
-- The old p_tax_percentage parameter is gone — products now store only the FK.

CREATE OR REPLACE FUNCTION public.create_product_atomic(
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
    p_tax_rate_id         bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_prefix    text;
    v_seq       integer;
    v_sku       text;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Permission denied: admin role required';
    END IF;

    SELECT prefix
    INTO v_prefix
    FROM product_categories
    WHERE id = p_category_id;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'Product category % not found', p_category_id;
    END IF;

    INSERT INTO sku_sequences (prefix, last_number)
    VALUES (v_prefix, 0)
    ON CONFLICT (prefix) DO NOTHING;

    SELECT last_number
    INTO v_seq
    FROM sku_sequences
    WHERE prefix = v_prefix
    FOR UPDATE;

    v_seq := v_seq + 1;

    UPDATE sku_sequences
    SET last_number = v_seq
    WHERE prefix = v_prefix;

    v_sku := v_prefix || LPAD(v_seq::text, 6, '0');

    INSERT INTO products (
        id,
        name,
        slug,
        product_category,
        sku,
        category,
        buying_price,
        price,
        discount_percentage,
        sale_price,
        description,
        images,
        badge,
        stock_quantity,
        featured,
        is_active,
        meta_title,
        meta_description,
        weight,
        dimensions,
        tax_rate_id
    ) VALUES (
        v_sku,
        p_name,
        p_slug,
        p_category_id,
        v_sku,
        p_category,
        p_buying_price,
        p_price,
        p_discount_percentage,
        p_sale_price,
        p_description,
        p_images,
        NULLIF(p_badge, ''),
        p_stock_quantity,
        p_featured,
        p_is_active,
        NULLIF(p_meta_title, ''),
        NULLIF(p_meta_description, ''),
        NULLIF(p_weight, 0),
        p_dimensions,
        p_tax_rate_id
    );

    RETURN v_sku;
END;
$$;

-- Re-grant since the function signature changed.
GRANT EXECUTE ON FUNCTION public.create_product_atomic(
    bigint, text, text, text, numeric, numeric, integer, numeric,
    text, jsonb, text, integer, boolean, boolean, text, text, integer, jsonb, bigint
) TO authenticated;
