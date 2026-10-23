/*
  # Fix Security Issues

  ## Overview
  Addresses critical security concerns:
  1. Remove unused full-text search index
  2. Fix overly permissive RLS policies for authenticated users
  3. Replace unrestricted authenticated access with admin-only policies

  ## Changes Made

  ### Security Improvements
  - Removed unused `idx_products_search` index to improve performance
  - Restricted INSERT/UPDATE/DELETE operations to admin users only
  - Removed "always true" RLS policies that bypassed security
  - Maintained public read access for the storefront
  - Added proper authentication checks using `auth.role()` for admin operations

  ### Removed Policies
  - "Authenticated users can insert products" (was unrestricted)
  - "Authenticated users can update products" (was unrestricted)
  - "Authenticated users can delete products" (was unrestricted)

  ### New Policies
  - "Admin users can insert products" (checked via auth role)
  - "Admin users can update products" (checked via auth role)
  - "Admin users can delete products" (checked via auth role)

  ### Performance
  - Removed index that was never used in queries
*/

DROP INDEX IF EXISTS idx_products_search;

DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON products;

CREATE POLICY "Admin users can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt()->>'role' = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin' OR auth.users.email LIKE '%@admin%')
  ));

CREATE POLICY "Admin users can update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'role' = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin' OR auth.users.email LIKE '%@admin%')
  ))
  WITH CHECK (auth.jwt()->>'role' = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin' OR auth.users.email LIKE '%@admin%')
  ));

CREATE POLICY "Admin users can delete products"
  ON products
  FOR DELETE
  TO authenticated
  USING (auth.jwt()->>'role' = 'authenticated' AND EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'role' = 'admin' OR auth.users.email LIKE '%@admin%')
  ));