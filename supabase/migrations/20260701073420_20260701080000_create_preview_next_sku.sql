-- Read-only SKU preview: returns what the next SKU *would* be for a given
-- category without touching sku_sequences.  Safe to call as many times as
-- needed — category changes, page loads, etc. — without wasting sequence numbers.
--
-- NOTE: The returned value is advisory only.  A concurrent create_product_atomic()
-- call may consume this number before the current user saves.  That is expected:
-- create_product_atomic() always generates the authoritative SKU inside its
-- own transaction.

CREATE OR REPLACE FUNCTION public.preview_next_sku(p_category_id bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix     text;
    v_last       integer;
    v_next       integer;
BEGIN
    SELECT prefix
    INTO v_prefix
    FROM product_categories
    WHERE id = p_category_id;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'Product category % not found', p_category_id;
    END IF;

    SELECT COALESCE(last_number, 0)
    INTO v_last
    FROM sku_sequences
    WHERE prefix = v_prefix;

    -- If no sequence row exists yet, the first product will be 000001.
    v_next := COALESCE(v_last, 0) + 1;

    RETURN v_prefix || LPAD(v_next::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_next_sku(bigint) TO authenticated;
