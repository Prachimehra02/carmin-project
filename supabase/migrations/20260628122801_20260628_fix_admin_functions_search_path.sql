-- Fix is_admin() and is_super_admin() to use SET search_path = public
-- This prevents RLS recursion and ensures SECURITY DEFINER works correctly

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'super_admin'
  );
END;
$$;

-- Also fix decrement_stock to use SET search_path
CREATE OR REPLACE FUNCTION public.decrement_stock(
  product_id uuid,
  decrement_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - decrement_quantity
  WHERE id = product_id;
END;
$$;
