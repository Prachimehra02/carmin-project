-- Creates a product and generates its SKU atomically in a single transaction.
--
-- The sequence row is locked with SELECT FOR UPDATE before incrementing,
-- making this safe for concurrent admin sessions — no two callers can read
-- the same last_number before either has committed its increment.
--
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS on
-- both sku_sequences and products so the insert always succeeds when called
-- by an authenticated admin.  The caller's admin status is checked explicitly
-- at the top of the function so non-admins cannot exploit the elevated rights.
--
-- If the INSERT fails for any reason (constraint, duplicate ID, etc.) the
-- UPDATE to sku_sequences is rolled back automatically — the sequence never
-- advances for a failed product creation.

CREATE OR REPLACE FUNCTION public.create_product_atomic(
    p_category_id        bigint,
    p_name               text,
    p_slug               text,
    p_category           text,
    p_buying_price       numeric,
    p_price              numeric,
    p_discount_percentage integer,
    p_sale_price         numeric,
    p_description        text,
    p_images             jsonb,
    p_badge              text,
    p_stock_quantity     integer,
    p_featured           boolean,
    p_is_active          boolean,
    p_meta_title         text,
    p_meta_description   text,
    p_weight             integer,
    p_dimensions         jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix    text;
    v_seq       integer;
    v_sku       text;
BEGIN
    -- Guard: only admins may call this function.
    -- is_admin() is already defined in this schema and checks admin_users.
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Permission denied: admin role required';
    END IF;

    -- Resolve the category prefix.
    SELECT prefix
    INTO v_prefix
    FROM product_categories
    WHERE id = p_category_id;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'Product category % not found', p_category_id;
    END IF;

    -- Ensure a sequence row exists for this prefix (idempotent).
    INSERT INTO sku_sequences (prefix, last_number)
    VALUES (v_prefix, 0)
    ON CONFLICT (prefix) DO NOTHING;

    -- Lock the sequence row to prevent concurrent reads of the same number.
    -- Any other session calling this function for the same prefix will wait
    -- here until this transaction commits or rolls back.
    SELECT last_number
    INTO v_seq
    FROM sku_sequences
    WHERE prefix = v_prefix
    FOR UPDATE;

    v_seq := v_seq + 1;

    -- Advance the sequence.
    UPDATE sku_sequences
    SET last_number = v_seq
    WHERE prefix = v_prefix;

    v_sku := v_prefix || LPAD(v_seq::text, 6, '0');

    -- Insert the product.  If this fails, the UPDATE above is rolled back.
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
        dimensions
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
        p_dimensions
    );

    RETURN v_sku;
END;
$$;

-- Grant execute to authenticated role (admin check is inside the function).
GRANT EXECUTE ON FUNCTION public.create_product_atomic(
    bigint, text, text, text, numeric, numeric, integer, numeric,
    text, jsonb, text, integer, boolean, boolean, text, text, integer, jsonb
) TO authenticated;
