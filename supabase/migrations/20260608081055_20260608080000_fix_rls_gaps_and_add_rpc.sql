/*
  # Fix Critical RLS Gaps

  1. Add admin SELECT policy to orders table
  2. Add admin UPDATE policy to orders table
  3. Add admin DELETE policy to order_items
  4. Add decrement_stock RPC for atomic inventory management
*/

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Admins can update all orders
CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Admins can delete order items (for order management)
CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Atomic stock decrement function (prevents race conditions)
CREATE OR REPLACE FUNCTION decrement_stock(product_id text, decrement_quantity integer)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_quantity = GREATEST(stock_quantity - decrement_quantity, 0)
  WHERE id = product_id AND stock_quantity >= decrement_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION decrement_stock(text, integer) TO authenticated;
