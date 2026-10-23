/*
  # Production E-commerce Schema Upgrade

  ## Overview
  Upgrades the database to a production-ready e-commerce schema:
  1. Add new columns to products table (slug, sku, stock, sale_price, etc.)
  2. Create addresses table
  3. Create order_items table (normalized from jsonb items)
  4. Add order fields (payment_status, order_status, tracking, totals)
  5. Create reviews table
  6. Create wishlist table (server-side)
  7. Create coupons table
  8. Add role to user_profiles
  9. Fix products RLS to use admin_users table
*/

-- ============================================================
-- 1. ADD NEW COLUMNS TO PRODUCTS TABLE
-- ============================================================

DO $$
BEGIN
  -- slug for SEO-friendly URLs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'slug') THEN
    ALTER TABLE products ADD COLUMN slug text UNIQUE;
  END IF;

  -- SKU for inventory tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku') THEN
    ALTER TABLE products ADD COLUMN sku text UNIQUE;
  END IF;

  -- Stock quantity for inventory management
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_quantity') THEN
    ALTER TABLE products ADD COLUMN stock_quantity integer NOT NULL DEFAULT 0;
  END IF;

  -- Sale price (null means no sale)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sale_price') THEN
    ALTER TABLE products ADD COLUMN sale_price integer;
  END IF;

  -- Featured flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'featured') THEN
    ALTER TABLE products ADD COLUMN featured boolean NOT NULL DEFAULT false;
  END IF;

  -- Active flag (soft delete / hide)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_active') THEN
    ALTER TABLE products ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  -- SEO meta title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'meta_title') THEN
    ALTER TABLE products ADD COLUMN meta_title text;
  END IF;

  -- SEO meta description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'meta_description') THEN
    ALTER TABLE products ADD COLUMN meta_description text;
  END IF;

  -- Weight in grams for shipping
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'weight') THEN
    ALTER TABLE products ADD COLUMN weight integer;
  END IF;

  -- Dimensions (jsonb: {length, width, height} in cm)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dimensions') THEN
    ALTER TABLE products ADD COLUMN dimensions jsonb;
  END IF;
END $$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity) WHERE stock_quantity < 10;

-- Auto-generate slugs for existing products
UPDATE products SET slug = lower(replace(replace(name, ' ', '-'), '''', '')) WHERE slug IS NULL;

-- ============================================================
-- 2. CREATE ADDRESSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL DEFAULT 'India',
  pincode text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own addresses"
  ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- ============================================================
-- 3. ADD ORDER COLUMNS & CREATE ORDER_ITEMS TABLE
-- ============================================================

DO $$
BEGIN
  -- Payment status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status text NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));
  END IF;

  -- Order status (more granular than existing 'status')
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_status') THEN
    ALTER TABLE orders ADD COLUMN order_status text NOT NULL DEFAULT 'pending'
      CHECK (order_status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));
  END IF;

  -- Tracking ID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_id') THEN
    ALTER TABLE orders ADD COLUMN tracking_id text;
  END IF;

  -- Subtotal
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'subtotal') THEN
    ALTER TABLE orders ADD COLUMN subtotal integer NOT NULL DEFAULT 0;
  END IF;

  -- Shipping charge
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_charge') THEN
    ALTER TABLE orders ADD COLUMN shipping_charge integer NOT NULL DEFAULT 0;
  END IF;

  -- Discount amount
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount') THEN
    ALTER TABLE orders ADD COLUMN discount integer NOT NULL DEFAULT 0;
  END IF;

  -- Grand total
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'grand_total') THEN
    ALTER TABLE orders ADD COLUMN grand_total integer NOT NULL DEFAULT 0;
  END IF;

  -- Shipping address (jsonb snapshot)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address') THEN
    ALTER TABLE orders ADD COLUMN shipping_address jsonb;
  END IF;

  -- Coupon code used
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'coupon_code') THEN
    ALTER TABLE orders ADD COLUMN coupon_code text;
  END IF;
END $$;

-- Create order_items table (normalized line items)
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  price integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Users can create own order items"
  ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

CREATE POLICY "Admins can update order items"
  ON order_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Backfill order_status from existing status column
UPDATE orders SET order_status = status WHERE order_status = 'pending' AND status IN ('completed', 'cancelled');
UPDATE orders SET payment_status = 'paid' WHERE status = 'completed';

-- Backfill subtotal/grand_total from total
UPDATE orders SET subtotal = total, grand_total = total WHERE subtotal = 0 AND total > 0;

-- ============================================================
-- 4. CREATE REVIEWS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete reviews"
  ON reviews FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- ============================================================
-- 5. CREATE WISHLIST TABLE (server-side, synced from localStorage)
-- ============================================================

CREATE TABLE IF NOT EXISTS wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist"
  ON wishlist FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wishlist items"
  ON wishlist FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist items"
  ON wishlist FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

-- ============================================================
-- 6. CREATE COUPONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value integer NOT NULL,
  minimum_order_amount integer NOT NULL DEFAULT 0,
  expiry_date timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active coupons"
  ON coupons FOR SELECT
  TO public USING (active = true AND (expiry_date IS NULL OR expiry_date > now()));

CREATE POLICY "Admins can view all coupons"
  ON coupons FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can create coupons"
  ON coupons FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can update coupons"
  ON coupons FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can delete coupons"
  ON coupons FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- 7. ADD ROLE TO USER_PROFILES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
    ALTER TABLE user_profiles ADD COLUMN role text NOT NULL DEFAULT 'customer'
      CHECK (role IN ('admin', 'customer'));
  END IF;
END $$;

-- ============================================================
-- 8. FIX PRODUCTS RLS - Use admin_users table instead of raw_app_meta_data
-- ============================================================

-- Drop the old admin policies that check auth.jwt() meta_data
DROP POLICY IF EXISTS "Admin users can insert products" ON products;
DROP POLICY IF EXISTS "Admin users can update products" ON products;
DROP POLICY IF EXISTS "Admin users can delete products" ON products;

-- Create new policies that use admin_users table
CREATE POLICY "Admin users can insert products"
  ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admin users can update products"
  ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admin users can delete products"
  ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Add index for admin order management
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
