/*
# Add admin RLS policies to categories table

## Purpose
The `categories` table already exists with columns: id, name, slug, sku_prefix,
parent_id, active, created_at, updated_at. It currently has only a public SELECT
policy for active categories. The admin panel needs INSERT/UPDATE/DELETE policies
and a broader admin SELECT to see inactive categories too.

## Changes
1. Add admin SELECT policy — admins can see all categories (active and inactive).
2. Add admin INSERT policy — only admins can create categories.
3. Add admin UPDATE policy — only admins can edit categories.
4. Add admin DELETE policy — only admins can delete categories.
5. Add a self-referencing FK on parent_id (if not already present).
6. Add a unique constraint on sku_prefix (if not already present).

## Security
- Public/anonymous users can only read ACTIVE categories (existing policy preserved).
- Admins (via is_admin_user()) can read all categories and perform full CRUD.
- No existing policies are removed or weakened.
*/

-- Add self-referencing FK if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_parent_id_fkey'
    AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add unique constraint on sku_prefix if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_sku_prefix_key'
    AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_sku_prefix_key UNIQUE (sku_prefix);
  END IF;
END $$;

-- Admin SELECT: admins can see all categories (including inactive)
DROP POLICY IF EXISTS "Admins can view all categories" ON categories;
CREATE POLICY "Admins can view all categories"
  ON categories FOR SELECT
  TO authenticated
  USING (is_admin_user());

-- Admin INSERT
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
CREATE POLICY "Admins can create categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

-- Admin UPDATE
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin DELETE
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (is_admin_user());

-- Add index on parent_id for tree lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
