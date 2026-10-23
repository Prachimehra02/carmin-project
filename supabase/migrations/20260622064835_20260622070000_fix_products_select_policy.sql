/*
  # Fix Products SELECT Policy

  ## Issue
  The products SELECT policy wasn't properly allowing public (anonymous) access.

  ## Solution
  1. Drop and recreate the public SELECT policy
  2. Add an admin-specific SELECT policy for viewing all products (including inactive)
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view products" ON products;

-- Recreate the public SELECT policy (allows anon and authenticated to read)
CREATE POLICY "Anyone can view products"
  ON products
  FOR SELECT
  TO public
  USING (true);

-- Add admin policy to see all products (including inactive)
DROP POLICY IF EXISTS "Admins can view all products" ON products;
CREATE POLICY "Admins can view all products"
  ON products
  FOR SELECT
  TO authenticated
  USING (is_admin());
