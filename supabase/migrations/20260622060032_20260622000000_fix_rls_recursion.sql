/*
  # Fix RLS Infinite Recursion

  ## Problem
  The admin_users table has policies that query admin_users within their own
  USING/WITH CHECK clauses, creating infinite recursion (error 42P17).

  ## Solution
  1. Create SECURITY DEFINER helper functions that bypass RLS:
     - is_admin() - checks if current user is in admin_users
     - is_super_admin() - checks if current user has super_admin role
  2. Replace all direct admin_users queries in policies with these functions
  3. Drop recursive policies and recreate them

  ## Tables Affected
  - admin_users (most critical - causes the recursion)
  - orders
  - order_items
  - products
*/

-- ============================================================================
-- STEP 1: Create SECURITY DEFINER helper functions
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_admin();

-- Create is_admin() function - bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
SELECT EXISTS (
  SELECT 1
  FROM admin_users
  WHERE user_id = auth.uid()
);
$$;

-- Create is_super_admin() function - for super admin checks
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
SELECT EXISTS (
  SELECT 1
  FROM admin_users
  WHERE user_id = auth.uid()
  AND role = 'super_admin'
);
$$;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;

-- ============================================================================
-- STEP 2: Fix admin_users policies (THE ROOT CAUSE OF RECURSION)
-- ============================================================================

-- Drop the recursive policies
DROP POLICY IF EXISTS "Super admin can view all admins" ON admin_users;
DROP POLICY IF EXISTS "Super admin can create admins" ON admin_users;
DROP POLICY IF EXISTS "Super admin can update admins" ON admin_users;
DROP POLICY IF EXISTS "Super admin can delete admins" ON admin_users;
DROP POLICY IF EXISTS "Admins can view own role" ON admin_users;

-- Create new non-recursive policies

-- SELECT: Users can see their own admin record OR super admins can see all
CREATE POLICY "Users can view own admin record"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin()
  );

-- INSERT: Only super admins can add new admins
CREATE POLICY "Super admin can create admins"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- UPDATE: Only super admins can modify admins (admins can't modify themselves)
CREATE POLICY "Super admin can update admins"
  ON admin_users FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- DELETE: Only super admins can delete admins
CREATE POLICY "Super admin can delete admins"
  ON admin_users FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- STEP 3: Fix orders policies
-- ============================================================================

-- Drop old policies that reference admin_users directly
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;

-- Create new policies using is_admin()
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add admin DELETE capability
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- STEP 4: Fix order_items policies
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON order_items;

-- Create new policies
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- STEP 5: Fix products policies
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Admin users can insert products" ON products;
DROP POLICY IF EXISTS "Admin users can update products" ON products;
DROP POLICY IF EXISTS "Admin users can delete products" ON products;

-- Create new policies
CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- STEP 6: Fix other tables that might reference admin_users
-- ============================================================================

-- Check and fix coupons table
DROP POLICY IF EXISTS "Admins can create coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can delete coupons" ON coupons;
DROP POLICY IF EXISTS "Admins can view all coupons" ON coupons;

CREATE POLICY "Admins can create coupons"
  ON coupons FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update coupons"
  ON coupons FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete coupons"
  ON coupons FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can view all coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (is_admin());

-- Reviews table
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;
CREATE POLICY "Admins can delete reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (is_admin());
