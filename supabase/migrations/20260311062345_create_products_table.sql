/*
  # Create Products Table

  ## Overview
  Creates a products table to store all e-commerce product information including
  pots, planters, and vases with images, pricing, and category data.

  ## New Tables
  
  ### `products`
  - `id` (text, primary key) - Unique product identifier
  - `name` (text, not null) - Product name
  - `category` (text, not null) - Product category (pots-planters, vases)
  - `price` (integer, not null) - Product price in rupees
  - `images` (jsonb, not null) - Array of image URLs
  - `description` (text, not null) - Product description
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on `products` table
  - Add policy for public read access (e-commerce site)
  - Add policy for authenticated admin insert/update/delete

  ## Indexes
  - Index on category for faster filtering
  - Index on price for sorting
  - Full text search index on name and description
*/

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price integer NOT NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON products
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
  ON products
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || description));