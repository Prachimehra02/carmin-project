/*
  # Add badge column to products table

  Adds support for product badges like "HANDCRAFTED" and "JUST ARRIVED"
  to display on product cards instead of random discounts.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'badge'
  ) THEN
    ALTER TABLE products ADD COLUMN badge text;
  END IF;
END $$;
