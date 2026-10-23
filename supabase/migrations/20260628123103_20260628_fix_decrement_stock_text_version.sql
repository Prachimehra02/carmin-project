-- Fix the original decrement_stock(text, integer) to add SET search_path
CREATE OR REPLACE FUNCTION public.decrement_stock(
  product_id text,
  decrement_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = GREATEST(stock_quantity - decrement_quantity, 0)
  WHERE id = product_id AND stock_quantity >= decrement_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', product_id;
  END IF;
END;
$$;
